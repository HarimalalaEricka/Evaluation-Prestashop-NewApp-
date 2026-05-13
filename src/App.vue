<template>
  <router-view />
</template>

<style>
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #122033;
  background:
    radial-gradient(circle at top left, rgba(252, 191, 73, 0.26), transparent 30%),
    radial-gradient(circle at top right, rgba(29, 78, 216, 0.16), transparent 28%),
    linear-gradient(180deg, #f8f4eb 0%, #f3efe7 100%);
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
  margin: 0;
}

body {
  min-height: 100vh;
}

a {
  color: inherit;
}
</style>
