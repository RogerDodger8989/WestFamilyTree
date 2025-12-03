# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Advanced Family Tree View (ny)

Ett nytt avancerat trädvist är lagt till i `src/FamilyTreeAdvanced.jsx`.
- Den använder rekursiva `<ul>/<li>`-noder och CSS-pseudo-element för linjer.
- Stöder collapse (`.collapsed`) med höjd- och opacitets-animation.
- Inbyggd "infinite canvas" med drag-to-pan och wheel-to-zoom (zoom mot muspekaren).
- Node-kort har dolda "ghost"-knappar för snabba relationer vid hover.

För att använda växlar du till fliken "Släktträd (Avancerad)" i appens toppnavigering. Den gamla `Släktträd`-vyn finns kvar.
// src/FamilyTreeAdvanced.jsx (eller var din TreeNode-komponent finns)

// Antagande: Du har en funktion `openDrawerForNewPerson` som du skickar som prop.
// Denna funktion tar ett objekt som beskriver den nya personen och dess relation.
function TreeNode({ person, openDrawerForNewPerson }) {
  // ... annan logik för noden

  const handleAddNewRelation = (relationType) => {
    // Skapa ett "skal"-objekt för den nya personen.
    // Här talar vi om vem den nya personen är relaterad TILL.
    const newPersonTemplate = {
      relationTo: person.id, // ID på personen vi klickade ifrån
      relationType: relationType, // 'parent', 'spouse', eller 'child'
    };

    // Anropa funktionen som öppnar drawern, men för en ny person.
    openDrawerForNewPerson(newPersonTemplate);
  };

  return (
    <div className="node-card">
      {/* ... befintlig kod för profilbild, namn etc. ... */}
      {/* Klick på profilbilden öppnar för redigering (befintlig funktion) */}
      <img src={person.imageUrl} onClick={() => openDrawerForExistingPerson(person)} />
      <h4>{person.name}</h4>

      {/* --- NYTT: Spökknappar med onClick-händelser --- */}
      <div className="ghost-buttons">
        {/* Knapp för att lägga till en förälder */}
        <button
          className="ghost-button add-parent"
          onClick={() => handleAddNewRelation('parent')}
          title="Lägg till förälder"
        >
          +
        </button>

        {/* Knapp för att lägga till en partner */}
        <button
          className="ghost-button add-spouse"
          onClick={() => handleAddNewRelation('spouse')}
          title="Lägg till partner"
        >
          +
        </button>

        {/* Knapp för att lägga till ett barn */}
        <button
          className="ghost-button add-child"
          onClick={() => handleAddNewRelation('child')}
          title="Lägg till barn"
        >
          +
        </button>
      </div>
    </div>
  );
}
// I din App.jsx eller där du hanterar state för drawern

const [drawerData, setDrawerData] = useState(null);
const [isDrawerOpen, setIsDrawerOpen] = useState(false);

// Funktion för att öppna för en NY person
const openDrawerForNewPerson = (template) => {
  // Sätt ett "mode" för att tala om för drawern vad den ska göra
  setDrawerData({ mode: 'create', template: template });
  setIsDrawerOpen(true);
};

// Funktion för att öppna för en BEFINTLIG person
const openDrawerForExistingPerson = (person) => {
  setDrawerData({ mode: 'edit', person: person });
  setIsDrawerOpen(true);
};

// ...

// När du renderar din Drawer
<PersonDrawer
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  data={drawerData}
  // ... andra props som onSave etc.
/>
// Inuti PersonDrawer.jsx

useEffect(() => {
  if (data?.mode === 'create') {
    // Nollställ formuläret och förbered för en ny person
    // Du kan använda data.template för att förifylla relationen
    console.log(`Skapa ny ${data.template.relationType} till person ${data.template.relationTo}`);
  } else if (data?.mode === 'edit') {
    // Fyll formuläret med data från data.person
  }
}, [data]);
