import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'dualscreen',
  description: 'Drive a second monitor from your web app. No server, no Electron, no second entry point.',
  base: process.env.DOCS_BASE ?? '/',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#2a78d6' }],
    ['meta', { property: 'og:title', content: 'dualscreen' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Click in one window, change what is shown in another. ~9 kB, zero dependencies, no server.',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'dualscreen',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/react', activeMatch: '/api/' },
      { text: 'Demos', link: '/demo/', target: '_blank' },
      { text: '0.1.0', items: [{ text: 'Changelog', link: '/changelog' }] },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'What it does', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Your first surface', link: '/guide/first-surface' },
          ],
        },
        {
          text: 'Core concepts',
          items: [
            { text: 'A surface is a route', link: '/guide/surfaces' },
            { text: 'Shared state', link: '/guide/shared-state' },
            { text: 'Ids, not payloads', link: '/guide/ids-not-payloads' },
            { text: 'Commands and events', link: '/guide/commands' },
          ],
        },
        {
          text: 'Windows and displays',
          items: [
            { text: 'Opening and placing', link: '/guide/placement' },
            { text: 'Browser support', link: '/guide/browser-support' },
            { text: 'The degradation ladder', link: '/guide/degradation' },
          ],
        },
        {
          text: 'Going further',
          items: [
            { text: 'Patterns', link: '/guide/patterns' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Custom transports', link: '/guide/transports' },
            { text: 'How it works', link: '/guide/internals' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Reference',
          items: [
            { text: '@dualscreen/react', link: '/api/react' },
            { text: '@dualscreen/core', link: '/api/core' },
            { text: '@dualscreen/screens', link: '/api/screens' },
            { text: '@dualscreen/devtools', link: '/api/devtools' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/phiceti/dualscreen' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/phiceti/dualscreen/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: { message: 'Released under the MIT License.', copyright: 'Copyright © 2026' },
  },
})
