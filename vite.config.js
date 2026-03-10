import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// import other plugins...

export default defineConfig({
  // Replace '<REPO_NAME>' with your actual GitHub repository name
  base: '/ProstheticsResearchSim/',
  plugins: [react()],
  // ...other configurations
})


// https://vitejs.dev/config/
