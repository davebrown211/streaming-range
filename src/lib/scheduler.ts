import cron from "node-cron";
import {
  updateAllVideoAccelerations,
  recordViewSnapshot,
} from "./acceleration";
import { wsServer } from "./websocket-server";
import pool from "./database";
import { channelMonitor } from "./channel-monitor";
import { videoService } from "./video-service";
import { quotaTracker } from "./quota-tracker";
import { contentQualityScorer } from "./content-quality-scorer";
import { WHITELISTED_CHANNEL_IDS } from "./content-whitelist";
import { internalApi } from "./internal-api";

class GolfDirectoryScheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = Date.now();

  start() {
    if (this.isRunning) {
      console.log("Scheduler already running");
      return;
    }

    console.log("Starting Golf Directory scheduler...");
    this.isRunning = true;

    // Every 2 minutes: View count updates for user-facing videos
    const viewUpdateTask = cron.schedule(
      "*/2 * * * *",
      async () => {
        try {
          await this.performViewCountUpdates();
        } catch (error) {
          console.error("FATAL: View count update task crashed:", error);
        }
      },
      {
        scheduled: false,
      }
    );

    // Every 30 minutes: Collect today's videos
    const collectTodayTask = cron.schedule(
      "*/30 * * * *",
      async () => {
        try {
          await this.performCollectTodayVideos();
        } catch (error) {
          console.error("FATAL: Collect today videos task crashed:", error);
        }
      },
      {
        scheduled: false,
      }
    );

    // Daily at 3 AM: Maintenance cycle for older popular videos
    const maintenanceTask = cron.schedule(
      "0 3 * * *",
      async () => {
        try {
          await this.performMaintenanceUpdate();
        } catch (error) {
          console.error("FATAL: Maintenance update task crashed:", error);
        }
      },
      {
        scheduled: false,
      }
    );

    this.tasks.set("viewUpdates", viewUpdateTask);
    this.tasks.set("collectToday", collectTodayTask);
    this.tasks.set("maintenance", maintenanceTask);

    // Start tasks
    viewUpdateTask.start();
    collectTodayTask.start();
    maintenanceTask.start();

    console.log("Scheduler tasks started:");
    console.log("- View count updates: Every 2 minutes");
    console.log("- Collect today videos: Every 30 minutes");
    console.log("- Maintenance update: Daily at 3 AM");

    // Run collect today videos immediately on startup
    console.log("Running initial collect today videos on startup...");
    setTimeout(() => {
      this.performCollectTodayVideos();
    }, 5000); // Wait 5 seconds for services to initialize

    // Start heartbeat monitoring
    this.startHeartbeat();
  }

  stop() {
    console.log("Stopping scheduler...");
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`Stopped task: ${name}`);
    });
    this.tasks.clear();
    this.isRunning = false;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat() {
    console.log("Starting scheduler heartbeat monitoring...");

    // Update heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.lastHeartbeat = Date.now();
      console.log(
        `Scheduler heartbeat: ${this.tasks.size} tasks active, running: ${this.isRunning}`
      );

      // Check if tasks are still active but scheduler thinks it's running
      if (this.isRunning && this.tasks.size === 0) {
        console.warn(
          "Scheduler shows running but no tasks active! Fixing state..."
        );
        this.isRunning = false;
      }

      // Only restart if scheduler was supposed to be running but all tasks disappeared
      // Don't restart just because tasks finished normally
    }, 30000);
  }

  private restart() {
    console.log("Restarting scheduler...");
    this.stop();
    setTimeout(() => {
      this.start();
    }, 2000);
  }

  private async performViewCountUpdates() {
    console.log("View count update...", new Date().toISOString());

    try {
      // Check quota first
      if (!(await quotaTracker.canPerformOperation("videoList"))) {
        console.log("Quota limit reached, skipping view updates");
        return;
      }

      const client = await pool.connect();

      try {
        // Get videos that are ACTUALLY being shown to users
        // Priority 1: Videos being displayed in user-facing APIs
        const displayedVideosQuery = `
          WITH user_facing_videos AS (
            -- Videos from curated-videos API (whitelisted creators, recent uploads)
            (SELECT yv.id, yv.view_count, yv.title, yc.title as channel_name, yv.updated_at, yv.published_at, 1 as priority
             FROM youtube_videos yv
             JOIN youtube_channels yc ON yv.channel_id = yc.id
             WHERE yv.channel_id = ANY($1::text[])
               AND yv.published_at >= NOW() - INTERVAL '90 days'
               AND yv.view_count > 100
               AND yv.duration_seconds >= 180
             ORDER BY yv.published_at DESC
             LIMIT 50)
            
            UNION ALL
            
            -- Video of the day candidates (trending recent videos)
            (SELECT yv.id, yv.view_count, yv.title, yc.title as channel_name, yv.updated_at, yv.published_at, 2 as priority
             FROM youtube_videos yv
             JOIN youtube_channels yc ON yv.channel_id = yc.id
             WHERE yv.published_at >= NOW() - INTERVAL '14 days'
               AND yv.view_count > 100
               AND yv.channel_id = ANY($1::text[])
               AND yv.thumbnail_url IS NOT NULL
               AND (yv.duration_seconds IS NULL OR yv.duration_seconds > 60)
             ORDER BY 
               CASE 
                 WHEN yv.published_at >= (NOW() AT TIME ZONE 'America/Chicago')::date THEN yv.view_count * 1000
                 WHEN yv.published_at >= NOW() - INTERVAL '24 hours' THEN yv.view_count * 100
                 WHEN yv.published_at >= NOW() - INTERVAL '48 hours' THEN yv.view_count * 10
                 ELSE yv.view_count
               END DESC
             LIMIT 20)
          )
          SELECT id, view_count, title, channel_name, MIN(priority) as priority
          FROM user_facing_videos
          WHERE (updated_at <= NOW() - INTERVAL '10 minutes'  -- Update every 10 min for displayed videos
                 OR published_at >= NOW() - INTERVAL '12 hours')  -- Fresh uploads need frequent updates
          GROUP BY id, view_count, title, channel_name
          ORDER BY MIN(priority), view_count DESC
          LIMIT 70
        `;

        const result = await client.query(displayedVideosQuery, [
          WHITELISTED_CHANNEL_IDS,
        ]);
        const videoIds = result.rows.map((row) => row.id);

        if (videoIds.length === 0) {
          console.log("No displayed videos need view count updates");
          return;
        }

        console.log(
          `Updating view counts for ${videoIds.length} user-facing videos`
        );

        // Get fresh data from YouTube API
        const updatedVideos = await videoService.updateVideoBatch(videoIds);

        // Record quota usage
        await quotaTracker.recordUsage(
          "video_update",
          Math.ceil(videoIds.length / 50)
        );

        console.log(
          `View count update: ${updatedVideos} displayed videos updated`
        );
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("View count update failed:", error);

      // Don't stop the scheduler for view count errors
      if (error instanceof Error && error.message.includes("quota")) {
        console.log("Quota exhausted, will retry next cycle");
      } else {
        console.error("Unexpected error in view count update:", error);
      }
    }
  }

  private async performCollectTodayVideos() {
    console.log("Collecting today videos...", new Date().toISOString());

    try {
      // 1. Collect today's videos
      const collectResult = await internalApi.collectTodayVideos();
      console.log(
        `Today videos collection completed: ${
          collectResult.videos_collected || 0
        } videos collected`
      );

      // 2. Check current video of the day and generate transcript summary if needed
      const vod = await internalApi.getVideoOfTheDay();

      // Check if we already have AI analysis for this video
      if (!vod.has_ai_analysis) {
        console.log(
          `Generating transcript summary for video of the day: "${vod.title}" (ID: ${vod.video_id})`
        );

        try {
          const result = await internalApi.generateTranscriptSummary(vod.video_id);
          console.log(
            "Transcript summary generation completed:",
            result.summary ? "Summary generated" : "No summary",
            result.audioUrl ? "Audio generated" : "No audio"
          );
        } catch (error) {
          console.error("Failed to generate transcript summary:", error);
        }
      } else {
        console.log("Video of the day already has AI analysis");
      }
    } catch (error) {
      console.error("Collect today videos failed:", error);
    }
  }

  private async performMaintenanceUpdate() {
    console.log(
      "Maintenance update for older popular videos...",
      new Date().toISOString()
    );

    try {
      // Check quota first
      if (!(await quotaTracker.canPerformOperation("videoList"))) {
        console.log("Quota limit reached, skipping maintenance update");
        return;
      }

      const client = await pool.connect();

      try {
        // Get older popular videos from whitelisted channels that haven't been updated recently
        const maintenanceQuery = `
          SELECT yv.id, yv.title, yc.title as channel_name, yv.view_count, yv.updated_at
          FROM youtube_videos yv
          JOIN youtube_channels yc ON yv.channel_id = yc.id
          WHERE yv.channel_id = ANY($1::text[])
            AND yv.published_at < NOW() - INTERVAL '90 days'  -- Older than regular updates
            AND yv.view_count > 500000  -- Popular videos only
            AND yv.updated_at < NOW() - INTERVAL '7 days'  -- Haven't been updated in a week
          ORDER BY yv.view_count DESC
          LIMIT 100
        `;

        const result = await client.query(maintenanceQuery, [
          WHITELISTED_CHANNEL_IDS,
        ]);
        const videoIds = result.rows.map((row) => row.id);

        if (videoIds.length === 0) {
          console.log("No older popular videos need maintenance updates");
          return;
        }

        console.log(
          `Maintenance updating ${videoIds.length} older popular videos`
        );

        // Update videos in batches of 50 (YouTube API limit)
        let totalUpdated = 0;
        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50);

          // Check quota for this batch
          if (!(await quotaTracker.canPerformOperation("videoList"))) {
            console.log("Quota limit reached during maintenance update");
            break;
          }

          try {
            const updated = await videoService.updateVideoBatch(batch);
            totalUpdated += updated;

            // Record quota usage
            await quotaTracker.recordUsage("video_update", 1);

            console.log(
              `Maintenance batch ${
                Math.floor(i / 50) + 1
              }: Updated ${updated} videos`
            );

            // Small delay between batches
            if (i + 50 < videoIds.length) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(
              `Maintenance batch error for videos ${i}-${i + 50}:`,
              error
            );
          }
        }

        console.log(
          `Maintenance update completed: ${totalUpdated} older popular videos updated`
        );
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Maintenance update failed:", error);
    }
  }

  private async performBatchVideoUpdate() {
    console.log("Batch video update...", new Date().toISOString());

    try {
      const startTime = Date.now();

      // Check quota before proceeding
      const usage = await quotaTracker.getTodayUsage();
      const remainingQuota = 10000 - usage.units_used;

      if (remainingQuota < 50) {
        console.log("Insufficient quota for batch update");
        return;
      }

      const client = await pool.connect();

      try {
        // Get videos that need updating - prioritize those shown to users
        const result = await client.query(
          `
          WITH video_priority AS (
            SELECT yv.id, yv.title, yv.view_count, yc.title as channel_name,
              CASE 
                -- Highest priority: Videos from whitelisted creators (shown in curated API)
                WHEN yv.channel_id = ANY($2::text[]) 
                     AND yv.published_at >= NOW() - INTERVAL '90 days'
                     AND yv.view_count > 100
                     AND yv.duration_seconds >= 180 THEN 1
                -- Medium priority: Recent trending candidates (video of the day)
                WHEN yv.published_at >= NOW() - INTERVAL '14 days'
                     AND yv.view_count > 100 THEN 2
                -- Lower priority: Other recent videos
                WHEN yv.published_at >= NOW() - INTERVAL '7 days' THEN 3
                -- Lowest priority: Popular older videos
                WHEN yv.view_count > 50000 THEN 4
                ELSE 5
              END as priority
            FROM youtube_videos yv
            JOIN youtube_channels yc ON yv.channel_id = yc.id
            WHERE yv.updated_at < NOW() - INTERVAL '1 hour'  -- More frequent updates
          )
          SELECT id, title, view_count, channel_name
          FROM video_priority
          ORDER BY priority, view_count DESC
          LIMIT $1
        `,
          [Math.min(remainingQuota * 30, 1500), WHITELISTED_CHANNEL_IDS]
        ); // Conservative limit based on quota

        const videoIds = result.rows.map((row) => row.id);

        if (videoIds.length === 0) {
          console.log("No videos need batch updating");
          return;
        }

        console.log(
          `Batch updating ${videoIds.length} videos for fresh view counts...`
        );

        // Update videos in batches of 50 (YouTube API limit)
        let totalUpdated = 0;
        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50);

          // Check quota for this batch
          if (!(await quotaTracker.canPerformOperation("videoList"))) {
            console.log("Quota limit reached during batch update");
            break;
          }

          try {
            const updated = await videoService.updateVideoBatch(batch);
            totalUpdated += updated;

            // Record quota usage (1 unit per batch)
            await quotaTracker.recordUsage("video_update", 1);

            console.log(
              `Batch ${Math.floor(i / 50) + 1}: Updated ${updated} videos`
            );

            // Small delay between batches
            if (i + 50 < videoIds.length) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.error(
              `Batch update error for videos ${i}-${i + 50}:`,
              error
            );
          }
        }

        const duration = Date.now() - startTime;
        console.log(
          `Batch update completed: ${totalUpdated} videos updated in ${(
            duration / 1000
          ).toFixed(1)}s`
        );
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Batch video update failed:", error);

      // Don't stop scheduler for batch update errors
      if (error instanceof Error && error.message.includes("quota")) {
        console.log("Quota exhausted for batch update, will retry next cycle");
      } else {
        console.error("Unexpected error in batch video update:", error);
      }
    }
  }

  private async performQualityScoring() {
    console.log("Quality scoring update...", new Date().toISOString());

    try {
      const startTime = Date.now();

      // Update quality scores for videos
      const videosScored = await contentQualityScorer.updateQualityScores(200);

      const duration = Date.now() - startTime;
      const summary = {
        videos_scored: videosScored,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      };

      console.log("Quality scoring completed:", summary);

      // Broadcast update if videos were scored
      if (videosScored > 0) {
        wsServer.broadcastStatsUpdate({
          message: "Content quality scoring completed",
          ...summary,
        });
      }
    } catch (error) {
      console.error("Quality scoring failed:", error);

      // Don't stop scheduler for quality scoring errors
      if (error instanceof Error && error.message.includes("quota")) {
        console.log(
          "Quota exhausted for quality scoring, will retry next cycle"
        );
      } else {
        console.error("Unexpected error in quality scoring:", error);
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      tasksCount: this.tasks.size,
      lastHeartbeat: new Date(this.lastHeartbeat).toISOString(),
      heartbeatActive: this.heartbeatInterval !== null,
    };
  }
}

// Singleton instance
export const scheduler = new GolfDirectoryScheduler();

// Removed auto-start to prevent conflicts with manual start
// The scheduler should be started via API endpoint only
