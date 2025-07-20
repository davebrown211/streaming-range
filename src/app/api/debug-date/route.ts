import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()
  const testDate = "2025-07-09"
  const publishedDate = new Date(testDate)
  
  // Test the getDaysAgo logic
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const publishedStart = new Date(publishedDate.getFullYear(), publishedDate.getMonth(), publishedDate.getDate())
  
  const diffTime = todayStart.getTime() - publishedStart.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  return NextResponse.json({
    now: now.toISOString(),
    nowLocal: now.toString(),
    todayStart: todayStart.toISOString(),
    testDate: testDate,
    publishedDate: publishedDate.toISOString(),
    publishedDateLocal: publishedDate.toString(),
    publishedStart: publishedStart.toISOString(),
    diffTime: diffTime,
    diffDays: diffDays,
    shouldShow: diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
}