import { NextRequest, NextResponse } from 'next/server'
import { quotaTracker } from '@/lib/quota-tracker'

export async function GET(request: NextRequest) {
  try {
    const usage = await quotaTracker.getTodayUsage()
    
    return NextResponse.json({
      date: usage.date,
      units_used: usage.units_used,
      units_remaining: 10000 - usage.units_used,
      percentage_used: ((usage.units_used / 10000) * 100).toFixed(2) + '%',
      operations: usage.operations,
      can_perform_search: usage.units_used + 100 <= 10000,
      can_perform_batch_update: usage.units_used + 1 <= 10000
    })
  } catch (error) {
    console.error('Failed to get quota usage:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get quota usage', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}