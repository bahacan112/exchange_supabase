import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'
import { BackupJob } from '@/lib/supabase'

interface BackupState {
  jobs: BackupJob[]
  activeJobs: BackupJob[]
  loading: boolean
  error: string | null
  stats: {
    totalEmails: number
    processedEmails: number
    failedEmails: number
    completedJobs: number
    runningJobs: number
  }
}

const initialState: BackupState = {
  jobs: [],
  activeJobs: [],
  loading: false,
  error: null,
  stats: {
    totalEmails: 0,
    processedEmails: 0,
    failedEmails: 0,
    completedJobs: 0,
    runningJobs: 0,
  },
}

// Async thunks
export const fetchBackupJobs = createAsyncThunk(
  'backup/fetchBackupJobs',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('backup_jobs')
        .select(`
          *,
          exchange_users (
            user_principal_name,
            display_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        return rejectWithValue(error.message)
      }

      return data || []
    } catch (error) {
      return rejectWithValue('Yedekleme işleri yüklenemedi')
    }
  }
)

export const fetchActiveJobs = createAsyncThunk(
  'backup/fetchActiveJobs',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('backup_jobs')
        .select(`
          *,
          exchange_users (
            user_principal_name,
            display_name
          )
        `)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })

      if (error) {
        return rejectWithValue(error.message)
      }

      return data || []
    } catch (error) {
      return rejectWithValue('Aktif işler yüklenemedi')
    }
  }
)

export const createBackupJob = createAsyncThunk(
  'backup/createBackupJob',
  async ({ 
    jobType, 
    exchangeUserId 
  }: { 
    jobType: 'full_backup' | 'incremental_backup' | 'daily_backup'
    exchangeUserId: string 
  }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('backup_jobs')
        .insert({
          job_type: jobType,
          exchange_user_id: exchangeUserId,
          status: 'pending',
          start_date: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        return rejectWithValue(error.message)
      }

      return data
    } catch (error) {
      return rejectWithValue('Yedekleme işi oluşturulamadı')
    }
  }
)

export const updateBackupJob = createAsyncThunk(
  'backup/updateBackupJob',
  async ({ 
    jobId, 
    updates 
  }: { 
    jobId: string
    updates: Partial<BackupJob>
  }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('backup_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .select()
        .single()

      if (error) {
        return rejectWithValue(error.message)
      }

      return data
    } catch (error) {
      return rejectWithValue('Yedekleme işi güncellenemedi')
    }
  }
)

export const fetchBackupStats = createAsyncThunk(
  'backup/fetchBackupStats',
  async (_, { rejectWithValue }) => {
    try {
      // Get total emails count
      const { count: totalEmails } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })

      // Get processed emails count
      const { count: processedEmails } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('backup_status', 'completed')

      // Get failed emails count
      const { count: failedEmails } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .eq('backup_status', 'failed')

      // Get completed jobs count
      const { count: completedJobs } = await supabase
        .from('backup_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')

      // Get running jobs count
      const { count: runningJobs } = await supabase
        .from('backup_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'running'])

      return {
        totalEmails: totalEmails || 0,
        processedEmails: processedEmails || 0,
        failedEmails: failedEmails || 0,
        completedJobs: completedJobs || 0,
        runningJobs: runningJobs || 0,
      }
    } catch (error) {
      return rejectWithValue('İstatistikler yüklenemedi')
    }
  }
)

const backupSlice = createSlice({
  name: 'backup',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    updateJobProgress: (state, action: PayloadAction<{ jobId: string; progress: Partial<BackupJob> }>) => {
      const { jobId, progress } = action.payload
      const jobIndex = state.jobs.findIndex(job => job.id === jobId)
      if (jobIndex !== -1) {
        state.jobs[jobIndex] = { ...state.jobs[jobIndex], ...progress }
      }
      
      const activeJobIndex = state.activeJobs.findIndex(job => job.id === jobId)
      if (activeJobIndex !== -1) {
        state.activeJobs[activeJobIndex] = { ...state.activeJobs[activeJobIndex], ...progress }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch backup jobs
      .addCase(fetchBackupJobs.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBackupJobs.fulfilled, (state, action) => {
        state.loading = false
        state.jobs = action.payload
        state.error = null
      })
      .addCase(fetchBackupJobs.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Fetch active jobs
      .addCase(fetchActiveJobs.fulfilled, (state, action) => {
        state.activeJobs = action.payload
      })
      // Create backup job
      .addCase(createBackupJob.fulfilled, (state, action) => {
        state.jobs.unshift(action.payload)
        state.activeJobs.unshift(action.payload)
      })
      // Update backup job
      .addCase(updateBackupJob.fulfilled, (state, action) => {
        const jobIndex = state.jobs.findIndex(job => job.id === action.payload.id)
        if (jobIndex !== -1) {
          state.jobs[jobIndex] = action.payload
        }
        
        const activeJobIndex = state.activeJobs.findIndex(job => job.id === action.payload.id)
        if (activeJobIndex !== -1) {
          if (action.payload.status === 'completed' || action.payload.status === 'failed') {
            state.activeJobs.splice(activeJobIndex, 1)
          } else {
            state.activeJobs[activeJobIndex] = action.payload
          }
        }
      })
      // Fetch backup stats
      .addCase(fetchBackupStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
  },
})

export const { clearError, updateJobProgress } = backupSlice.actions
export default backupSlice.reducer