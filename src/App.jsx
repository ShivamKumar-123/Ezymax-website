import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { PopupProvider } from './components/PopupContext'
import ScrollProgress from './components/animations/ScrollProgress'
import PageTransition from './components/animations/PageTransition'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Forex from './pages/Forex'
import Commodities from './pages/Commodities'
import Indices from './pages/Indices'
import Crypto from './pages/Crypto'
import WebPlatform from './pages/WebPlatform'
import SuperAdmin from './pages/SuperAdmin'
import CopyTrading from './pages/CopyTrading'
import PropTrading from './pages/PropTrading'
import IBManagement from './pages/IBManagement'
import StandardAccount from './pages/StandardAccount'
import ProAccount from './pages/ProAccount'
import DemoAccount from './pages/DemoAccount'
import AboutUs from './pages/AboutUs'
import WhyTrustEdgeFX from './pages/WhyTrustEdgeFX'
import Contact from './pages/Contact'
import Blog from './pages/Blog'
import Tutorials from './pages/Tutorials'
import MarketNews from './pages/MarketNews'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const AnimatedRoutes = () => {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/trading/forex" element={<PageTransition><Forex /></PageTransition>} />
        <Route path="/trading/commodities" element={<PageTransition><Commodities /></PageTransition>} />
        <Route path="/trading/indices" element={<PageTransition><Indices /></PageTransition>} />
        <Route path="/trading/crypto" element={<PageTransition><Crypto /></PageTransition>} />
        <Route path="/platforms/web" element={<PageTransition><WebPlatform /></PageTransition>} />
        <Route path="/platforms/super-admin" element={<PageTransition><SuperAdmin /></PageTransition>} />
        <Route path="/platforms/copy-trading" element={<PageTransition><CopyTrading /></PageTransition>} />
        <Route path="/platforms/prop-trading" element={<PageTransition><PropTrading /></PageTransition>} />
        <Route path="/platforms/ib-management" element={<PageTransition><IBManagement /></PageTransition>} />
        <Route path="/accounts/standard" element={<PageTransition><StandardAccount /></PageTransition>} />
        <Route path="/accounts/pro" element={<PageTransition><ProAccount /></PageTransition>} />
        <Route path="/accounts/demo" element={<PageTransition><DemoAccount /></PageTransition>} />
        <Route path="/company/about" element={<PageTransition><AboutUs /></PageTransition>} />
        <Route path="/company/why-trustedge" element={<PageTransition><WhyTrustEdgeFX /></PageTransition>} />
        <Route path="/company/contact" element={<PageTransition><Contact /></PageTransition>} />
        <Route path="/education/blog" element={<PageTransition><Blog /></PageTransition>} />
        <Route path="/education/tutorials" element={<PageTransition><Tutorials /></PageTransition>} />
        <Route path="/education/news" element={<PageTransition><MarketNews /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <Router>
      <PopupProvider>
      <ScrollToTop />
      <ScrollProgress />
      <div className="min-h-screen">
        <Navbar />
        <AnimatedRoutes />
        <Footer />
      </div>
      </PopupProvider>
    </Router>
  )
}

export default App
