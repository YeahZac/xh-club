import { PropsWithChildren } from 'react';
import { LucideTaroProvider } from 'lucide-react-taro';
import '@/app.css';
import { Toaster } from '@/components/ui/toast';
import { WxLoginSheet } from '@/components/wx-login-sheet';
import { Preset } from './presets';

const App = ({ children }: PropsWithChildren) => {
  return (
    <LucideTaroProvider defaultColor="#000" defaultSize={24}>
      <Preset>{children}</Preset>
      <WxLoginSheet />
      <Toaster />
    </LucideTaroProvider>
  );
};

export default App;
