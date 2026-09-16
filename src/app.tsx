import { PropsWithChildren, useEffect } from 'react'
import { useDidShow } from '@tarojs/taro'
import { LucideTaroProvider } from 'lucide-react-taro'
import '@/app.css'
import { Toaster } from '@/components/ui/toast'
import { PrivacyAuthorization } from '@/components/privacy-authorization'
import { registerPrivacyAuthorizationListener } from '@/lib/privacy-authorization'
import { ensurePersistedSession } from '@/lib/auth'
import { Preset } from './presets'

const App = ({ children }: PropsWithChildren) => {
  useEffect(() => {
    registerPrivacyAuthorizationListener()
  }, [])

  useDidShow(() => {
    ensurePersistedSession()
  })

  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <PrivacyAuthorization />
      <Toaster />
    </LucideTaroProvider>
  )
}

export default App
