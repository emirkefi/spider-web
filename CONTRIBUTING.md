# Contributing to SpiderWeb

Thank you for your interest in contributing to **SpiderWeb**! Whether you are fixing a bug, adding a keyboard shortcut, or improving Wayland/Hyprland integration, your contributions are welcome.

## Development Workflow

### 1. Fork & Clone
```bash
git clone https://github.com/emirkefi/spider-web.git
cd spider-web
npm install
```

### 2. Run in UI Development Mode
```bash
npm run dev
```

### 3. Build the Standalone Native GTK4 Binary
Make sure `gtk4`, `webkitgtk-6.0`, and `gcc` are installed, then run:
```bash
npm run build:native
./spiderweb
```

## Pull Request Checklist

1. Create a feature branch (`git checkout -b feat/your-feature`).
2. Ensure TypeScript compiles cleanly (`npm run build`).
3. Verify the native GTK4 executable builds without warnings (`npm run build:native`).
4. Keep the UI responsive, keyboard-accessible, and clean in both Light and Dark modes.
5. Open a Pull Request describing your changes!
