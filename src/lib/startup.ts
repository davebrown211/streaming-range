// Startup checks and initialization
import { scheduler } from './scheduler'
import { channelMonitor } from './channel-monitor'
import pool from './database'

export class StartupManager {
  private static initialized = false

  static async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('🚀 Starting StreamingRange initialization...')

    try {
      // 1. Check database connection
      await this.checkDatabase()
      
      // 2. Initialize channel monitoring
      await this.initializeChannelMonitoring()
      
      // 3. Ensure scheduler is running
      await this.ensureSchedulerRunning()
      
      this.initialized = true
      console.log('✅ StreamingRange initialization complete!')
      
    } catch (error) {
      console.error('❌ Startup initialization failed:', error)
      throw error
    }
  }

  private static async checkDatabase(): Promise<void> {
    let retries = 3
    while (retries > 0) {
      try {
        const client = await pool.connect()
        await client.query('SELECT 1')
        client.release()
        console.log('✅ Database connection verified')
        return
      } catch (error) {
        retries--
        console.error(`❌ Database connection failed (${3-retries}/3):`, error)
        if (retries === 0) {
          throw error
        }
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  private static async initializeChannelMonitoring(): Promise<void> {
    try {
      await channelMonitor.initializeChannels()
      console.log('✅ Channel monitoring initialized')
    } catch (error) {
      console.error('❌ Channel monitoring initialization failed:', error)
      // Don't throw - channel monitoring is not critical for startup
    }
  }

  private static async ensureSchedulerRunning(): Promise<void> {
    try {
      // Wait a moment for scheduler auto-start
      await new Promise(resolve => setTimeout(resolve, 6000))
      
      const status = scheduler.getStatus()
      if (!status.isRunning) {
        console.log('⚡ Starting scheduler manually...')
        scheduler.start()
        
        // Verify it started
        const newStatus = scheduler.getStatus()
        if (newStatus.isRunning) {
          console.log(`✅ Scheduler started with ${newStatus.tasksCount} tasks`)
        } else {
          console.error('❌ Failed to start scheduler')
        }
      } else {
        console.log(`✅ Scheduler already running with ${status.tasksCount} tasks`)
      }
    } catch (error) {
      console.error('❌ Scheduler startup failed:', error)
      // Don't throw - scheduler can be started manually later
    }
  }

  static getStatus(): { initialized: boolean } {
    return { initialized: this.initialized }
  }
}

// Auto-initialize in server-side environments (but not during build)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  // Small delay to let imports settle
  setTimeout(() => {
    StartupManager.initialize().catch(console.error)
  }, 1000)
}

export default StartupManager