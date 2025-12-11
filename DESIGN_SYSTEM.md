# 🎨 WestFamilyTree - Design System Guide

## Introduktion

Detta är en omfattande guide för att använda det nya färgschemat baserat på MediaManagerModal-designen. Färgerna är konsistenta över hele appen för en professionell och enhetlig upplevelse.

---

## 📋 Färgpalett

### Primära Färger (Blå)
```
#3b82f6 - Primary Blue (5)        ← använd denna för knappab & fokus
#2563eb - Primary Blue Dark (6)   ← använd denna för hover
#1d4ed8 - Primary Blue (7)        ← använd denna för active state
```

### Neutrala Färger (Slate/Grå)
```
#0f172a - Slate 900 (darkest bg)
#1a202c - Slate 850 (dark bg)
#1e293b - Slate 800 (medium bg)
#334155 - Slate 700 (hover bg)
#475569 - Slate 600 (borders)
#64748b - Slate 500 (text muted)
#94a3b8 - Slate 400 (text tertiary)
#cbd5e1 - Slate 300 (text secondary)
```

### Accent Färger
```
#f59e0b - Yellow 500 (varningar, okopplade)
#ef4444 - Red 500 (destruktiva åtgärder)
#22c55e - Green 500 (bekräftelse)
```

---

## 🎯 Implementering

### 1. Importera Design Tokens

I din **main.jsx** eller huvudkomponent:

```javascript
import './design-tokens.css';
```

Eller i vilken CSS-fil som helst:

```css
@import url('./design-tokens.css');
```

### 2. Använd CSS-variabler

I JSX/Tailwind:

```jsx
// Bästa: Använd Tailwind-klasser
<button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
  Klick mig
</button>

// Alternativt: Använd CSS-variabler
<button style={{ 
  backgroundColor: 'var(--color-primary-600)',
  color: 'var(--color-text-primary)'
}}>
  Klick mig
</button>

// Custom CSS: Använd variabler
.my-custom-button {
  background-color: var(--color-primary-600);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}

.my-custom-button:hover {
  background-color: var(--color-primary-500);
}
```

---

## 🎨 Tailwind Klasser (Rekommenderat)

### Bakgrunder

```jsx
// Primär (darkest)
className="bg-slate-900"

// Sekundär (dark)
className="bg-slate-850" // eller bg-[#1a202c]

// Tertiär (medium)
className="bg-slate-800"

// Hover
className="hover:bg-slate-700"

// Blå accenter
className="bg-blue-600 hover:bg-blue-500"
```

### Text

```jsx
// Primär text (vit)
className="text-white"

// Sekundär text
className="text-slate-300"

// Tertiär text
className="text-slate-400"

// Muted text
className="text-slate-500"

// Fokus/aktiv
className="text-blue-600"
```

### Borders

```jsx
// Primär border
className="border border-slate-700"

// Sekundär border
className="border border-slate-600"

// Ljus border
className="border border-slate-500"

// Focus border (blå)
className="focus:border-blue-500"
```

---

## 💡 Exempel: Knapp-komponent

### OLD (icke-konsistent)
```jsx
<button className="bg-blue-600 hover:bg-gray-500 text-white px-4 py-2">
  Klick
</button>
```

### NEW (konsistent med design system)
```jsx
<button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium border border-slate-600 transition-colors">
  Klick
</button>
```

---

## 📦 Komponenter - Rekommenderad Struktur

### Button
```jsx
<button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
  {children}
</button>
```

### Input/Textarea
```jsx
<input 
  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500" 
  placeholder="Skriv något..."
/>
```

### Modal/Card
```jsx
<div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
  <div className="border-b border-slate-700 p-4 bg-slate-900">
    <h2 className="text-white font-bold">Titel</h2>
  </div>
  <div className="p-4">
    {/* Content */}
  </div>
</div>
```

### Badge/Tag
```jsx
<span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
  Tag
</span>

// Eller med färg:
<span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
  Aktiv
</span>
```

### Navigation Tab
```jsx
<button className={`
  py-2 px-4 border-b-2 font-medium text-sm transition-colors
  ${isActive 
    ? 'border-blue-600 text-blue-600 bg-blue-50 rounded-t' 
    : 'border-transparent text-slate-500 hover:text-blue-700 hover:border-slate-300'
  }
`}>
  {label}
</button>
```

---

## 🔄 Migrering av Befintlig Kod

### Steg 1: Identifiera All Styling
```jsx
// OLD
className="bg-gray-700 text-gray-200 hover:bg-gray-600"

// NEW
className="bg-slate-700 text-slate-300 hover:bg-slate-600"
```

### Steg 2: Uppdatera Till Konsistent Färg
```jsx
// OLD
<button className="bg-purple-600 hover:bg-blue-500">

// NEW  
<button className="bg-blue-600 hover:bg-blue-500">
```

### Steg 3: Standardisera Hover/Focus
```jsx
// OLD
<button className="hover:bg-gray-500 focus:outline-red-400">

// NEW
<button className="hover:bg-blue-500 focus:border-blue-500">
```

---

## ✅ Checklist för Nya Komponenter

När du skapar nya komponenter, följ denna checklist:

- [ ] Använd `bg-slate-900` / `bg-slate-800` för bakgrund
- [ ] Använd `text-white` eller `text-slate-300` för text
- [ ] Använd `border-slate-700` / `border-slate-600` för borders
- [ ] Använd `bg-blue-600 hover:bg-blue-500` för primär-knappor
- [ ] Använd `hover:text-blue-600` för länk-interaktion
- [ ] Lägg till `transition-colors` på interaktiva element
- [ ] Använd `rounded` eller `rounded-lg` för rundade hörn
- [ ] Använd `text-xs` / `text-sm` / `text-base` för text-storlekar
- [ ] Test fokus-states med `focus:border-blue-500`

---

## 🚫 Undvik (Anti-patterns)

```jsx
// ❌ UNDVIK - Blandade färger
className="bg-gray-700 border-red-400 text-purple-200"

// ❌ UNDVIK - Felaktig hover
className="hover:bg-gray-400 hover:text-green-600"

// ❌ UNDVIK - Utan övergång
className="bg-slate-700 hover:bg-blue-500" // (snabbt, hakigt)

// ❌ UNDVIK - Otydliga fokus-states
className="focus:outline-none" // (utan ersättning)

// ✅ GÖR - Konsistent
className="bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors rounded focus:border-blue-500"
```

---

## 🎬 CSS-variabler i JavaScript

```javascript
// Läs en CSS-variabel
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-primary-600')
  .trim(); // #2563eb

// Sätt en CSS-variabel (om behövs för tema-switch)
document.documentElement.style.setProperty('--color-primary-600', '#3b82f6');
```

---

## 📱 Responsive Design

Kombinera design-tokens med Tailwind responsive-klasser:

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg hover:border-slate-600">
    {/* Card */}
  </div>
</div>
```

---

## 🌙 Dark/Light Mode (För Framtiden)

CSS-variablerna är redan inställda för dark mode. Om light mode läggs till senare:

```css
@media (prefers-color-scheme: light) {
  :root {
    --color-bg-primary: var(--color-neutral-50);
    --color-text-primary: var(--color-neutral-900);
    /* ... etc */
  }
}
```

---

## 📞 Support & Frågor

Använd denna guide när:
- Du skapar nya komponenter
- Du uppdaterar befintlig styling
- Du behöver veta vilken färg som ska användas
- Du undrar om något är konsistent

**Fråga: "Vilken färg ska jag använda för X?"**
- Primär interaktion → `blue-600` / `var(--color-primary-600)`
- Bakgrund → `slate-900` / `slate-800`
- Text → `white` eller `slate-300`
- Varning → `yellow-500` / `var(--color-warning)`
- Fel → `red-600` / `var(--color-error)`

---

**Lycka till med utvecklingen! 🚀**
