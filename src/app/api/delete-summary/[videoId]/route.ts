import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export async function DELETE(request: NextRequest, { params }: { params: { videoId: string } }) {
  const { videoId } = params
  
  try {
    const client = await pool.connect()
    
    try {
      const query = `
        DELETE FROM video_analyses 
        WHERE youtube_url LIKE '%' || $1 || '%'
      `
      
      const result = await client.query(query, [videoId])
      
      return NextResponse.json({ 
        message: 'Summary deleted successfully',
        deletedRows: result.rowCount
      })
      
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error('Error deleting summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}