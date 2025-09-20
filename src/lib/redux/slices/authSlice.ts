import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '@/lib/supabase'

interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
}

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return rejectWithValue(error.message || 'Giriş başarısız')
      }

      if (!data.user || !data.session) {
        return rejectWithValue('Kullanıcı bilgileri alınamadı')
      }

      // Store session in localStorage
      localStorage.setItem('token', data.session.access_token)
      
      // Kullanıcı bilgilerini oluştur
      const user: AuthUser = {
        id: data.user.id,
        username: data.user.email || '',
        role: 'admin' // Varsayılan olarak admin, gerekirse user metadata'dan alınabilir
      }
      
      localStorage.setItem('auth_user', JSON.stringify(user))

      return { user, token: data.session.access_token }
    } catch (error) {
      return rejectWithValue('Giriş işlemi başarısız')
    }
  }
)

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async () => {
    // Supabase'den çıkış yap
    await supabase.auth.signOut()
    
    // localStorage'ı temizle
    localStorage.removeItem('auth_user')
    localStorage.removeItem('token')
    
    return null
  }
)

export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { rejectWithValue }) => {
    try {
      // Supabase session'ını kontrol et
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Session check error:', error)
        // Hata durumunda localStorage'ı temizle
        localStorage.removeItem('auth_user')
        localStorage.removeItem('token')
        return null
      }

      if (!session || !session.user) {
        // Session yoksa localStorage'ı temizle
        localStorage.removeItem('auth_user')
        localStorage.removeItem('token')
        return null
      }

      // Session varsa token'ı güncelle
      localStorage.setItem('token', session.access_token)
      
      // Kullanıcı bilgilerini oluştur veya localStorage'dan al
      let user: AuthUser
      const storedUser = localStorage.getItem('auth_user')
      
      if (storedUser) {
        user = JSON.parse(storedUser)
      } else {
        user = {
          id: session.user.id,
          username: session.user.email || '',
          role: 'admin' // Varsayılan olarak admin
        }
        localStorage.setItem('auth_user', JSON.stringify(user))
      }

      return user
    } catch (error) {
      console.error('Auth check failed:', error)
      // Hata durumunda localStorage'ı temizle
      localStorage.removeItem('auth_user')
      localStorage.removeItem('token')
      return null
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload
      state.isAuthenticated = true
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.isAuthenticated = false
        state.user = null
        state.error = action.payload as string
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false
        state.user = null
        state.error = null
      })
      // Check auth status
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false
        if (action.payload) {
          state.isAuthenticated = true
          state.user = action.payload
        } else {
          state.isAuthenticated = false
          state.user = null
        }
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.loading = false
        state.isAuthenticated = false
        state.user = null
      })
  }
})

export const { clearError, setUser } = authSlice.actions
export default authSlice.reducer