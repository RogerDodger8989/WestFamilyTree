import sys
import json
import pyexiv2

# Usage: python write_facetags_xmp.py <imagefile> <facetags_json>
# facetags_json: '[{"x":..., "y":..., "w":..., "h":..., "personId":...}, ...]'

def write_facetags_xmp(image_path, facetags):
    metadata = pyexiv2.ImageMetadata(image_path)
    metadata.read()
    # Spara facetaggar som JSON i ett custom XMP-fält
    xmp_key = 'Xmp.WestFamilyTree.Facetags'
    metadata[xmp_key] = json.dumps(facetags)
    metadata.write()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python write_facetags_xmp.py <imagefile> <facetags_json>")
        sys.exit(1)
    imagefile = sys.argv[1]
    facetags_json = sys.argv[2]
    facetags = json.loads(facetags_json)
    write_facetags_xmp(imagefile, facetags)
    print(f"Facetags saved to XMP in {imagefile}")
