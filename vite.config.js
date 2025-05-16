export default {
    root: 'src',
    base: './',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 4000,  // Allow larger chunks for production
      target: 'es2015',  // Make sure the target is suitable for older browsers if necessary
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['express', 'babylonjs', 'delaunay-triangulate']  // Put libraries like React and lodash into a separate chunk
          }
        }
      }
    }
  }