import { SimulationProvider } from '@/context/SimulationContext';
import './globals.css';

export const metadata = {
  title: 'E-AKIP BPBD Boyolali - Evaluasi Akuntabilitas Kinerja',
  description: 'Aplikasi Evaluasi Akuntabilitas Kinerja Perangkat Daerah BPBD Boyolali',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SimulationProvider>
          {children}
        </SimulationProvider>
      </body>
    </html>
  );
}
