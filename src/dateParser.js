const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', maj: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
    // Lägg till fullständiga namn
    januari: '01', februari: '02', mars: '03', april: '04', maj: '05', juni: '06',
    juli: '07', augusti: '08', september: '09', oktober: '10', november: '11', december: '12'
};

export function parseDateString(input) {
    if (!input || typeof input !== 'string') return input;

    const str = input.trim().toLowerCase();

    // Hantera nyckelord
    if (str.startsWith('omk')) {
        const year = str.match(/\d{4}/);
        return year ? `Omk. ${year[0]}` : input;
    }
    if (str.startsWith('mellan')) {
        const years = str.match(/\d{4}/g);
        return years && years.length === 2 ? `Mellan ${years[0]}-${years[1]}` : input;
    }
    if (str.startsWith('före')) {
        const year = str.match(/\d{4}/);
        return year ? `Före ${year[0]}` : input;
    }
    if (str.startsWith('efter')) {
        const year = str.match(/\d{4}/);
        return year ? `Efter ${year[0]}` : input;
    }

    // Försök parsa datum med månadens namn, t.ex. "12 april 1900"
    const parts = str.replace(/,/g, '').split(' ');
    const monthPart = parts.find(p => monthMap[p]);
    const yearPart = parts.find(p => p.match(/^\d{4}$/));

    if (monthPart && yearPart) {
        const dayPart = parts.find(p => p.match(/^\d{1,2}$/))?.padStart(2, '0') || '01';
        const month = monthMap[monthPart];
        return `${yearPart}-${month}-${dayPart}`;
    }

    // Försök med JavaScripts inbyggda parser (hanterar t.ex. "April 12 1900")
    const d = new Date(input);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        // Kontrollera att året är rimligt (inte 1970 från en tom sträng)
        if (year > 1000) {
            return `${year}-${month}-${day}`;
        }
    }

    // Om inget annat fungerar, returnera originalinput
    return input;
}
