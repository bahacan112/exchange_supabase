import { configureStore } from '@reduxjs/toolkit'
import authSlice from '@/lib/redux/slices/authSlice'
import backupSlice from '@/lib/redux/slices/backupSlice'
import usersSlice from '@/lib/redux/slices/usersSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    backup: backupSlice,
    users: usersSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch