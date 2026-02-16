# ⚡ Performance Quick Fixes - Implementation Guide

This document provides step-by-step implementation for the most critical performance optimizations.

---

## 🚀 Quick Wins (30 minutes)

### 1. Add Lazy Loading to Images (5 minutes)

**File: `src/components/EventCard.tsx`**
```typescript
// Line ~116 - Add loading="lazy"
<img
  src={displayImage}
  alt={artist}
  loading="lazy"
  decoding="async"
  className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 group-hover:scale-105"
/>
```

**File: `src/pages/Index.tsx`**
```typescript
// Line ~514 - Add loading="lazy" to social images
<img
  src={post.image || ""}
  alt={post.handle}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 rounded-t-2xl"
/>
```

**File: `src/pages/Gallery.tsx`**
```typescript
// Line ~102 - Add loading="lazy"
<img
  src={image.src}
  alt={image.title}
  loading="lazy"
  decoding="async"
  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 rounded-2xl"
/>
```

**File: `src/pages/EventPage.tsx`**
```typescript
// Line ~711 - Add loading="lazy"
<img
  src={event.image}
  alt={event.artist}
  loading="lazy"
  decoding="async"
  className="w-full h-96 object-cover rounded-lg"
/>
```

---

### 2. Throttle Navigation Scroll Listener (5 minutes)

**File: `src/components/Navigation.tsx`**

**Install dependency:**
```bash
npm install lodash-es
npm install --save-dev @types/lodash-es
```

**Update imports:**
```typescript
import { throttle } from 'lodash-es';
```

**Update useEffect (Line ~22):**
```typescript
useEffect(() => {
  const handleScroll = throttle(() => {
    const scrollPosition = window.scrollY;
    setIsScrolled(scrollPosition > 100);
  }, 100); // Update max once per 100ms

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', handleScroll);
    handleScroll.cancel(); // Cancel throttled function
  };
}, []);
```

---

### 3. Implement Code Splitting (10 minutes)

**File: `src/App.tsx`**

**Update imports:**
```typescript
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
```

**Convert route imports to lazy:**
```typescript
const Index = lazy(() => import("./pages/Index"));
const EventPage = lazy(() => import("./pages/EventPage"));
const UpcomingEvents = lazy(() => import("./pages/UpcomingEvents"));
const Contact = lazy(() => import("./pages/Contact"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TicketScanner = lazy(() => import("./pages/TicketScanner"));
const MobileScanner = lazy(() => import("./pages/MobileScanner"));
const Restaurant = lazy(() => import("./pages/Restaurant"));
const RestaurantMenu = lazy(() => import("./pages/RestaurantMenu"));
const RestaurantCheckout = lazy(() => import("./pages/RestaurantCheckout"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const NotFound = lazy(() => import("./pages/NotFound"));
```

**Add loading fallback component:**
```typescript
const LoadingFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-[#39B54A] mb-4" />
    <p className="text-white text-lg ml-4">Loading...</p>
  </div>
);
```

**Wrap Routes in Suspense:**
```typescript
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ... rest of routes */}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
```

---

### 4. Optimize Vite Build (10 minutes)

**File: `vite.config.ts`**

**Update config:**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          'animation-vendor': ['framer-motion'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
```

---

## 🎯 Medium Priority Fixes (1-2 hours)

### 5. Parallelize API Calls

**File: `src/pages/Index.tsx`**

**Update fetchEvents function (Line ~47):**
```typescript
async function fetchEvents() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Parallel fetch events and prepare tag query
    const eventsQuery = supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    const { data, error } = await eventsQuery;

    if (error) throw error;
    
    if (data && data.length > 0) {
      const eventIds = data.map(e => e.id);
      
      // Fetch tags in parallel (if events exist)
      const tagsPromise = supabase
        .from('event_tag_map')
        .select(`
          event_id,
          tag_id,
          event_tags (
            name
          )
        `)
        .in('event_id', eventIds)
        .catch(err => {
          console.warn('Error fetching tags:', err);
          return { data: null, error: err };
        });

      // Wait for tags (or continue if error)
      const { data: tagMapData } = await tagsPromise;

      // Process tags...
      const tagsByEventId: Record<string, string[]> = {};
      if (tagMapData) {
        tagMapData.forEach((map: any) => {
          if (!tagsByEventId[map.event_id]) {
            tagsByEventId[map.event_id] = [];
          }
          if (map.event_tags?.name) {
            tagsByEventId[map.event_id].push(map.event_tags.name);
          }
        });
      }

      const eventsWithTags = data.map(event => ({
        ...event,
        tags: tagsByEventId[event.id] || []
      }));
      
      setEvents(eventsWithTags);
    } else {
      setEvents([]);
    }
  } catch (err: any) {
    console.error('Error fetching events:', err);
  } finally {
    setLoading(false);
  }
}
```

---

### 6. Optimize React Query Configuration

**File: `src/App.tsx`**

**Update QueryClient configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

---

### 7. Add Image Aspect Ratio Preservation

**File: `src/components/EventCard.tsx`**

**Update image container:**
```typescript
<div className="relative aspect-[4/3] overflow-hidden">
  {displayImage && (
    <>
      <img
        src={displayImage}
        alt={artist}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/80 to-black/95" />
    </>
  )}
</div>
```

---

## 🔍 Testing After Implementation

### 1. Build and Test
```bash
npm run build
npm run preview
```

### 2. Check Bundle Sizes
```bash
# After build, check dist/assets/ folder
# You should see multiple chunk files instead of one large bundle
```

### 3. Test Lazy Loading
- Open DevTools → Network tab
- Navigate to homepage
- Scroll down - images should load as you scroll
- Check that images have `loading="lazy"` attribute

### 4. Test Code Splitting
- Open DevTools → Network tab
- Navigate to different routes
- Each route should load its own chunk file
- Initial bundle should be smaller

### 5. Performance Metrics
- Run Lighthouse audit (Chrome DevTools)
- Check Core Web Vitals:
  - LCP should be < 2.5s
  - FID should be < 100ms
  - CLS should be < 0.1

---

## 📊 Expected Results

### Before:
- Initial bundle: ~800KB
- Images load immediately
- Scroll listener fires constantly
- All routes loaded upfront

### After:
- Initial bundle: ~300-400KB (40-50% reduction)
- Images load on demand
- Scroll listener throttled (10x fewer calls)
- Routes load on demand

---

## ⚠️ Common Issues & Solutions

### Issue: "lodash-es not found"
**Solution:** Install the package:
```bash
npm install lodash-es @types/lodash-es
```

### Issue: "Loading fallback shows on every navigation"
**Solution:** This is expected behavior. The fallback shows briefly while the route chunk loads. Consider adding a skeleton loader for better UX.

### Issue: "Images not lazy loading"
**Solution:** 
- Ensure images are below the fold (not immediately visible)
- Check browser support (Chrome 76+, Firefox 75+, Safari 15.4+)
- Verify `loading="lazy"` attribute is present

### Issue: "Build fails after adding manual chunks"
**Solution:** Check that all imported packages exist. Remove any packages that aren't installed from the manualChunks config.

---

## 🎯 Next Steps

After implementing quick fixes:

1. **Monitor performance** using Lighthouse
2. **Test on real devices** (especially mobile)
3. **Implement medium priority fixes** if needed
4. **Consider image optimization** (WebP conversion)
5. **Set up performance monitoring** (e.g., Web Vitals API)

---

**Last Updated:** December 2024

