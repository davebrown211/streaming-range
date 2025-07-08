#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:3000/api"

def collect_additional_videos():
    """Collect additional videos with more specific golf terms"""
    
    # Additional diverse golf search terms
    additional_terms = [
        # Specific golf personalities/channels
        "TaylorMade golf",
        "Callaway golf",
        "Titleist golf tips",
        "Bryson DeChambeau golf",
        "Tiger Woods highlights",
        "Phil Mickelson golf",
        
        # Specific techniques
        "golf draw shot",
        "golf fade technique",
        "golf bunker shots",
        "golf course management tips",
        
        # Amateur golf
        "amateur golf tournament",
        "golf scramble tips",
        "high handicap golf",
        "beginner golf mistakes",
        
        # Golf technology
        "golf simulator setup",
        "Trackman golf data",
        "golf GPS watch",
        "golf launch monitor",
        
        # Seasonal/Regional
        "winter golf tips",
        "desert golf courses",
        "Scottish links golf",
        "golf in rain"
    ]
    
    print("=== Additional Golf Video Collection ===")
    print(f"Collecting videos for {len(additional_terms)} specialized terms")
    
    # Use first 8 terms to stay conservative with quota
    response = requests.post(
        f"{BASE_URL}/collect-videos-efficient?max_searches=8",
        json={"searchTerms": additional_terms[:8]}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\nVideos Processed: {result['videos_processed']}")
        print(f"Estimated Quota Used: {result['estimated_quota_used']}")
        print(f"Duration: {result['duration_ms']/1000:.2f}s")
        return result
    else:
        print(f"Error collecting videos: {response.status_code}")
        if response.text:
            print(f"Error details: {response.text}")
        return None

def check_final_stats():
    """Check final statistics"""
    response = requests.get(f"{BASE_URL}/stats")
    if response.status_code == 200:
        stats = response.json()
        print("\n=== Final Stats ===")
        print(f"Total Videos: {stats['total_videos']:,}")
        print(f"Total Channels: {stats['total_channels']:,}")
        
        # Show category growth
        print("\nCategory Distribution:")
        categories = stats.get('categories', {})
        total = sum(categories.values())
        for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total * 100) if total > 0 else 0
            print(f"  {category}: {count:,} ({percentage:.1f}%)")
        
        return stats
    else:
        print(f"Error checking stats: {response.status_code}")
        return None

def check_final_quota():
    """Check final quota status"""
    response = requests.get(f"{BASE_URL}/quota/usage")
    if response.status_code == 200:
        quota = response.json()
        print("\n=== Final Quota Status ===")
        print(f"Units Used Today: {quota['units_used']:,}")
        print(f"Units Remaining: {quota['units_remaining']:,}")
        
        # Calculate efficiency
        response = requests.get(f"{BASE_URL}/stats")
        if response.status_code == 200:
            stats = response.json()
            if quota['units_used'] > 0:
                videos_per_unit = stats['total_videos'] / quota['units_used']
                print(f"Efficiency: {videos_per_unit:.2f} videos per quota unit")
        
        return quota
    else:
        print(f"Error checking quota: {response.status_code}")
        return None

def main():
    # Run additional collection
    result = collect_additional_videos()
    
    if result:
        # Wait a bit before checking final stats
        time.sleep(2)
        
        # Check final results
        check_final_stats()
        check_final_quota()
        
        print("\n=== Collection Complete ===")
        print("Successfully collected diverse golf content while maintaining quota efficiency!")

if __name__ == "__main__":
    main()