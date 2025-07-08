#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def check_stats():
    """Check current video collection statistics"""
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code == 200:
        stats = response.json()
        print("\n=== Current Stats ===")
        print(f"Total Videos: {stats['total_videos']:,}")
        print(f"Total Channels: {stats['total_channels']:,}")
        print("\nCategories:")
        for category, count in stats.get('categories', {}).items():
            print(f"  {category}: {count:,}")
        return stats
    else:
        print(f"Error checking stats: {response.status_code}")
        return None

def check_quota():
    """Check current quota usage"""
    response = requests.get(f"{BASE_URL}/quota/usage")
    if response.status_code == 200:
        quota = response.json()
        print("\n=== Quota Status ===")
        print(f"Units Used Today: {quota['units_used']:,}")
        print(f"Units Remaining: {quota['units_remaining']:,}")
        if 'reset_time' in quota:
            print(f"Reset Time: {quota['reset_time']}")
        return quota
    else:
        print(f"Error checking quota: {response.status_code}")
        return None

def check_channels(limit=50):
    """Check channels for new videos"""
    print(f"\n=== Checking {limit} Channels for New Videos ===")
    response = requests.post(f"{BASE_URL}/channels/check?limit={limit}")
    if response.status_code == 200:
        result = response.json()
        print(f"Channels Checked: {result['channels_checked']}")
        print(f"New Videos Found: {result['new_videos_found']}")
        print(f"Quota Used: {result['quota_used']}")
        print(f"Quota Remaining: {result['quota_remaining']:,}")
        return result
    else:
        print(f"Error checking channels: {response.status_code}")
        return None

def collect_videos_with_terms(search_terms, max_searches=10):
    """Collect videos using specific search terms"""
    print(f"\n=== Collecting Videos with {len(search_terms)} Search Terms ===")
    print(f"Max searches: {max_searches}")
    
    response = requests.post(
        f"{BASE_URL}/collect-videos-efficient?max_searches={max_searches}",
        json={"searchTerms": search_terms[:max_searches]}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"Videos Processed: {result['videos_processed']}")
        print(f"Estimated Quota Used: {result['estimated_quota_used']}")
        print(f"Duration: {result['duration_ms']/1000:.2f}s")
        return result
    else:
        print(f"Error collecting videos: {response.status_code}")
        return None

def main():
    """Main collection workflow"""
    print("Starting Golf Video Collection")
    
    # 1. Check initial stats
    initial_stats = check_stats()
    initial_quota = check_quota()
    
    if initial_quota and initial_quota['units_remaining'] < 1000:
        print("\nWarning: Low quota remaining. Proceeding with caution.")
        return
    
    # 2. Check 50 channels for new videos
    time.sleep(2)
    channel_result = check_channels(50)
    
    # 3. Collect videos with diverse search terms
    time.sleep(2)
    
    # Golf-specific search terms we haven't used much
    diverse_search_terms = [
        # Technical/Instruction
        "golf driver tips",
        "golf iron play",
        "golf short game",
        "golf putting technique",
        "golf chipping drills",
        
        # Equipment/Reviews
        "golf club review 2024",
        "best golf balls",
        "golf rangefinder",
        "golf shoes review",
        "golf bag essentials",
        
        # Professional Golf
        "LPGA highlights",
        "European Tour golf",
        "Masters Tournament",
        "US Open golf",
        "Ryder Cup moments",
        
        # Golf Entertainment
        "golf trick shots",
        "mini golf challenge",
        "golf course vlogs",
        "golf fails compilation",
        "celebrity golf",
        
        # Golf Fitness/Training
        "golf fitness exercises",
        "golf flexibility training",
        "golf mental game",
        "golf practice routine",
        "golf warm up drills",
        
        # Course Management
        "golf course strategy",
        "golf course review",
        "links golf tips",
        "golf in bad weather",
        "golf etiquette guide"
    ]
    
    # Collect with first 10 terms to stay within quota
    video_result = collect_videos_with_terms(diverse_search_terms, max_searches=10)
    
    # 4. Check final stats
    time.sleep(2)
    final_stats = check_stats()
    final_quota = check_quota()
    
    # Summary
    print("\n=== Collection Summary ===")
    if initial_stats and final_stats:
        videos_added = final_stats['total_videos'] - initial_stats['total_videos']
        channels_added = final_stats['total_channels'] - initial_stats['total_channels']
        print(f"Videos Added: {videos_added:,}")
        print(f"Channels Added: {channels_added:,}")
    
    if initial_quota and final_quota:
        quota_used = initial_quota['units_used'] - final_quota['units_used']
        print(f"Total Quota Used: {abs(quota_used):,}")
        print(f"Final Quota Remaining: {final_quota['units_remaining']:,}")

if __name__ == "__main__":
    main()