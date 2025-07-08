import { NextResponse } from 'next/server'
import { scheduler } from '@/lib/scheduler'

export async function GET() {
  try {
    const status = scheduler.getStatus()
    
    return NextResponse.json({
      scheduler: status,
      server_time: new Date().toISOString(),
      uptime_hours: process.uptime() / 3600,
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    )
  }
}