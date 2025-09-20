import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'
import { ExchangeUser } from '@/lib/supabase'

interface UsersState {
  users: ExchangeUser[]
  selectedUser: ExchangeUser | null
  loading: boolean
  error: string | null
  syncStatus: {
    [userId: string]: {
      isSync: boolean
      progress: number
      lastSync?: string
    }
  }
}

const initialState: UsersState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
  syncStatus: {},
}

// Async thunks
export const fetchExchangeUsers = createAsyncThunk(
  'users/fetchExchangeUsers',
  async (_, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('exchange_users')
        .select('*')
        .order('display_name', { ascending: true })

      if (error) {
        return rejectWithValue(error.message)
      }

      return data || []
    } catch (error) {
      return rejectWithValue('Kullanıcılar yüklenemedi')
    }
  }
)

export const createExchangeUser = createAsyncThunk(
  'users/createExchangeUser',
  async (userData: Omit<ExchangeUser, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('exchange_users')
        .insert(userData)
        .select()
        .single()

      if (error) {
        return rejectWithValue(error.message)
      }

      return data
    } catch (error) {
      return rejectWithValue('Kullanıcı oluşturulamadı')
    }
  }
)

export const updateExchangeUser = createAsyncThunk(
  'users/updateExchangeUser',
  async ({ 
    userId, 
    updates 
  }: { 
    userId: string
    updates: Partial<ExchangeUser>
  }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('exchange_users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        return rejectWithValue(error.message)
      }

      return data
    } catch (error) {
      return rejectWithValue('Kullanıcı güncellenemedi')
    }
  }
)

export const deleteExchangeUser = createAsyncThunk(
  'users/deleteExchangeUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('exchange_users')
        .delete()
        .eq('id', userId)

      if (error) {
        return rejectWithValue(error.message)
      }

      return userId
    } catch (error) {
      return rejectWithValue('Kullanıcı silinemedi')
    }
  }
)

export const syncUserFromExchange = createAsyncThunk(
  'users/syncUserFromExchange',
  async (userPrincipalName: string, { rejectWithValue, dispatch }) => {
    try {
      // Set sync status
      dispatch(setSyncStatus({ 
        userId: userPrincipalName, 
        status: { isSync: true, progress: 0 } 
      }))

      // Call API to sync user from Exchange
      const response = await fetch('/api/sync/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userPrincipalName }),
      })

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      const result = await response.json()
      
      // Update sync status
      dispatch(setSyncStatus({ 
        userId: userPrincipalName, 
        status: { 
          isSync: false, 
          progress: 100, 
          lastSync: new Date().toISOString() 
        } 
      }))

      return result.user
    } catch (error) {
      dispatch(setSyncStatus({ 
        userId: userPrincipalName, 
        status: { isSync: false, progress: 0 } 
      }))
      return rejectWithValue('Kullanıcı senkronizasyonu başarısız')
    }
  }
)

export const bulkSyncUsersFromExchange = createAsyncThunk(
  'users/bulkSyncUsersFromExchange',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      // Call API to sync all users from Exchange
      const response = await fetch('/api/sync/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Bulk sync failed')
      }

      const result = await response.json()
      
      // Refresh users list
      dispatch(fetchExchangeUsers())

      return result
    } catch (error) {
      return rejectWithValue('Toplu senkronizasyon başarısız')
    }
  }
)

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setSelectedUser: (state, action: PayloadAction<ExchangeUser | null>) => {
      state.selectedUser = action.payload
    },
    setSyncStatus: (state, action: PayloadAction<{ 
      userId: string
      status: { isSync: boolean; progress: number; lastSync?: string }
    }>) => {
      const { userId, status } = action.payload
      state.syncStatus[userId] = status
    },
    updateSyncProgress: (state, action: PayloadAction<{ userId: string; progress: number }>) => {
      const { userId, progress } = action.payload
      if (state.syncStatus[userId]) {
        state.syncStatus[userId].progress = progress
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch exchange users
      .addCase(fetchExchangeUsers.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchExchangeUsers.fulfilled, (state, action) => {
        state.loading = false
        state.users = action.payload
        state.error = null
      })
      .addCase(fetchExchangeUsers.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Create exchange user
      .addCase(createExchangeUser.fulfilled, (state, action) => {
        state.users.push(action.payload)
      })
      .addCase(createExchangeUser.rejected, (state, action) => {
        state.error = action.payload as string
      })
      // Update exchange user
      .addCase(updateExchangeUser.fulfilled, (state, action) => {
        const userIndex = state.users.findIndex(user => user.id === action.payload.id)
        if (userIndex !== -1) {
          state.users[userIndex] = action.payload
        }
        if (state.selectedUser?.id === action.payload.id) {
          state.selectedUser = action.payload
        }
      })
      .addCase(updateExchangeUser.rejected, (state, action) => {
        state.error = action.payload as string
      })
      // Delete exchange user
      .addCase(deleteExchangeUser.fulfilled, (state, action) => {
        state.users = state.users.filter(user => user.id !== action.payload)
        if (state.selectedUser?.id === action.payload) {
          state.selectedUser = null
        }
      })
      .addCase(deleteExchangeUser.rejected, (state, action) => {
        state.error = action.payload as string
      })
      // Sync user from Exchange
      .addCase(syncUserFromExchange.fulfilled, (state, action) => {
        const existingUserIndex = state.users.findIndex(
          user => user.user_principal_name === action.payload.user_principal_name
        )
        if (existingUserIndex !== -1) {
          state.users[existingUserIndex] = action.payload
        } else {
          state.users.push(action.payload)
        }
      })
      .addCase(syncUserFromExchange.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

export const { 
  clearError, 
  setSelectedUser, 
  setSyncStatus, 
  updateSyncProgress 
} = usersSlice.actions

export default usersSlice.reducer