
const fs = require('fs');
const path = require('path');
const gedcom = require('parse-gedcom');

const gedFilePath = path.join('c:\\Users\\denni\\Desktop\\Egna appar\\WestFamilyTree\\docs', 'lilly.ged');
const content = fs.readFileSync(gedFilePath, 'utf-8');
const data = gedcom.parse(content);

const getChild = (node, tag) => (node.children || []).find(c => c.tag === tag);

data.forEach(node => {
    if (node.tag === "INDI") {
        const sexNode = getChild(node, "SEX");
        const sexValue = (sexNode ? sexNode.value : "").trim().toUpperCase();
        const isFemale = ['F','K','KVINNA','FEMALE','2'].includes(sexValue);
        
        console.log(`Individual: ${node.id}`);
        console.log(`SEX Node found: ${!!sexNode}`);
        if(sexNode) {
            console.log(`SEX Value: "${sexNode.value}"`);
            console.log(`SEX Value cleaned: "${sexValue}"`);
        }
        console.log(`Is Female: ${isFemale} -> Final Gender: ${isFemale ? 'K' : 'M'}`);
        console.log('---');
    }
});
