import { NextResponse } from 'next/server'
import { scheduler } from '@/lib/scheduler'

export async function POST() {
  try {
    scheduler.start()
    
    return NextResponse.json({
      message: 'Scheduler started',
      status: scheduler.getStatus()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start scheduler', message: (error as Error).message },
      { status: 500 }
    )
  }
}