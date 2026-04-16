Lägg in dessa tre filer i denna mapp för Leaflet-kartan:

- marker-icon.png
- marker-icon-2x.png
- marker-shadow.png

Du hittar dem i:
node_modules/leaflet/dist/images/

Kopiera dem hit, så kommer Leaflet att hitta dem även i produktion.

Om du använder Vite, Webpack eller liknande, se till att de kopieras till din build/public-mapp automatiskt.