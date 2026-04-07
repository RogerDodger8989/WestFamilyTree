"""
EXIF Manager - Hanterar EXIF-metadata, face tags och keywords med piexif och exiftool

MWG-Regions (Metadata Working Group) format:
  Xmp.mwg-rs.Regions/mwg-rs:RegionList
    - mwg-rs:Name: Person name
    - mwg-rs:Type: "Face"
    - mwg-rs:Area:
      - stArea:x: 0-1 (normalized)
      - stArea:y: 0-1 (normalized)
      - stArea:w: 0-1 (normalized, width)
      - stArea:h: 0-1 (normalized, height)

Frontend uses 0-100% format, we convert between formats.
"""

import piexif
from PIL import Image
import json
import os
from typing import Dict, List, Optional, Tuple
import shutil
from datetime import datetime
import re
import subprocess


class ExifManager:
    """Hanterar EXIF-metadata för bilder"""
    
    def __init__(self):
        self.backup_dir = "backups/exif"
        os.makedirs(self.backup_dir, exist_ok=True)
    
    def read_exif(self, image_path: str) -> Dict:
        """
        Läser all EXIF-data från en bild
        
        Returns:
            Dict med strukturerad EXIF-data
        """
        try:
            exif_dict = piexif.load(image_path)
            xmp_data = self._extract_xmp_bytes(image_path)
            exiftool_fields = self._read_exiftool_fields(image_path)
            
            result = {
                'face_tags': self._extract_face_tags(exif_dict, xmp_data),
                'keywords': self._extract_keywords(exif_dict, xmp_data, exiftool_fields),
                'metadata': self._extract_metadata(exif_dict, xmp_data, exiftool_fields),
                'camera': self._extract_camera_info(exif_dict),
                'gps': self._extract_gps(exif_dict),
                'raw_exif': self._safe_exif_dict(exif_dict)
            }
            
            return result
            
        except Exception as e:
            print(f"Error reading EXIF from {image_path}: {e}")
            return {
                'face_tags': [],
                'keywords': [],
                'metadata': {},
                'camera': {},
                'gps': None,
                'error': str(e)
            }
    
    def _extract_xmp_bytes(self, image_path: str) -> bytes:
        """Returnerar XMP-sektionen som råbytes (best-effort)."""
        try:
            with open(image_path, 'rb') as f:
                data = f.read()
            # XMP brukar ligga mellan <x:xmpmeta ...> ... </x:xmpmeta>
            match = re.search(br"<x:xmpmeta[\s\S]*?</x:xmpmeta>", data, re.IGNORECASE)
            return match.group(0) if match else b''
        except Exception:
            return b''

    def _decode_xmp_string(self, raw_bytes: bytes) -> str:
        """
        Dekoderar XMP-strängar med robust hantering av olika kodningar.
        XMP ska vara UTF-8 enligt standard.
        """
        # XMP är UTF-8 enligt standard
        try:
            return raw_bytes.decode('utf-8')
        except UnicodeDecodeError:
            pass
        
        # Fallback: cp1252 (Windows), sedan latin-1
        for enc in ('cp1252', 'latin-1'):
            try:
                return raw_bytes.decode(enc)
            except (UnicodeDecodeError, AttributeError):
                continue
        
        # Sista utväg: ersätt ogiltiga tecken
        return raw_bytes.decode('utf-8', errors='replace')

    def _read_exiftool_fields(self, image_path: str) -> Dict:
        """Läser utvalda metadatafält via exiftool (för bättre XMP/IPTC-täckning)."""
        if not self._has_exiftool():
            return {}

        tags = [
            '-XMP:Creator',
            '-IPTC:By-line',
            '-XMP:Subject',
            '-IPTC:Keywords',
            '-XMP-lr:HierarchicalSubject'
        ]

        try:
            result = subprocess.run(
                ['exiftool', '-j', *tags, image_path],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode != 0 or not result.stdout:
                return {}

            payload = json.loads(result.stdout)
            if not isinstance(payload, list) or not payload:
                return {}
            return payload[0] if isinstance(payload[0], dict) else {}
        except Exception:
            return {}
    
    def _extract_face_tags(self, exif_dict: Dict, xmp_bytes: bytes = b"") -> List[Dict]:
        """
        Extraherar face tags från XMP-data
        
        Söker efter:
        1. MWG Regions (mwg-rs:Name + mwg-rs:Area/stArea:x,y,w,h) - Lightroom, DigiKam
        2. Microsoft Photo RegionInfo (MPReg:PersonDisplayName)
        3. XMP PersonInImage (names without coordinates)
        
        Returns list of dicts with:
          - name: Person name
          - x, y, width, height: Normalized 0-100 (frontend format)
          - source: "XMP:MWG-Regions" | "XMP:Microsoft-RegionInfo" | "XMP:PersonInImage"
        """
        face_tags = []
        
        # Kolla XMP-data
        try:
            if xmp_bytes:
                xmp_str = self._decode_xmp_string(xmp_bytes)
                
                # 1. MWG Regions: Extract region entries with structure
                # <mwg-rs:RegionList>
                #   <rdf:Bag>
                #     <rdf:li>
                #       <mwg-rs:Region>
                #         <mwg-rs:Name>Person Name</mwg-rs:Name>
                #         <mwg-rs:Type>Face</mwg-rs:Type>
                #         <mwg-rs:Area stArea:x="0.4" stArea:y="0.3" stArea:w="0.2" stArea:h="0.2" stArea:unit="normalized"/>
                #       </mwg-rs:Region>
                #     </rdf:li>
                #   </rdf:Bag>
                # </mwg-rs:RegionList>
                
                # Find all mwg-rs:Region entries
                region_pattern = r'<mwg-rs:Region>\s*(.*?)\s*</mwg-rs:Region>'
                for region_match in re.finditer(region_pattern, xmp_str, re.DOTALL):
                    region_content = region_match.group(1)
                    
                    # Extract Name
                    name_match = re.search(r'<mwg-rs:Name>([^<]+)</mwg-rs:Name>', region_content)
                    name = name_match.group(1) if name_match else None
                    
                    # Extract Type (should be "Face")
                    type_match = re.search(r'<mwg-rs:Type>([^<]+)</mwg-rs:Type>', region_content)
                    region_type = type_match.group(1) if type_match else ""
                    
                    # Extract Area coordinates (normalized 0-1)
                    area_match = re.search(
                        r'<mwg-rs:Area\s+stArea:x="([^"]+)"\s+stArea:y="([^"]+)"\s+stArea:w="([^"]+)"\s+stArea:h="([^"]+)"',
                        region_content
                    )
                    
                    # Also handle different attribute order (more robust)
                    if not area_match:
                        # Alternative regex that's more flexible
                        x_match = re.search(r'stArea:x="([^"]+)"', region_content)
                        y_match = re.search(r'stArea:y="([^"]+)"', region_content)
                        w_match = re.search(r'stArea:w="([^"]+)"', region_content)
                        h_match = re.search(r'stArea:h="([^"]+)"', region_content)
                        
                        if x_match and y_match and w_match and h_match:
                            try:
                                x_norm = float(x_match.group(1))
                                y_norm = float(y_match.group(1))
                                w_norm = float(w_match.group(1))
                                h_norm = float(h_match.group(1))
                            except ValueError:
                                continue
                        else:
                            x_norm, y_norm, w_norm, h_norm = None, None, None, None
                    else:
                        try:
                            x_norm = float(area_match.group(1))
                            y_norm = float(area_match.group(2))
                            w_norm = float(area_match.group(3))
                            h_norm = float(area_match.group(4))
                        except ValueError:
                            x_norm, y_norm, w_norm, h_norm = None, None, None, None
                    
                    # Only add if we have a name and it's actually a Face region
                    if name and region_type == "Face":
                        tag = {
                            'name': name.strip(),
                            'source': 'XMP:MWG-Regions'
                        }
                        
                        # Add coordinates if available (already normalized 0-1, convert to 0-100)
                        if x_norm is not None and y_norm is not None and w_norm is not None and h_norm is not None:
                            tag['x'] = x_norm * 100
                            tag['y'] = y_norm * 100
                            tag['width'] = w_norm * 100
                            tag['height'] = h_norm * 100
                        
                        face_tags.append(tag)
                
                # 2. Microsoft Photo: MPReg:PersonDisplayName="Person Name" (legacy, without coordinates)
                for match in re.finditer(br'MPReg:PersonDisplayName="([^"]+)"', xmp_bytes):
                    name_bytes = match.group(1)
                    person = self._decode_xmp_string(name_bytes)
                    face_tags.append({
                        'name': person.strip(),
                        'source': 'XMP:Microsoft-RegionInfo'
                    })
                
                # 3. Fallback: XMP PersonInImage <rdf:li>Person Name</rdf:li> (legacy, without coordinates)
                pi_blocks = re.findall(
                    r'<rdf:Description[^>]*?PersonInImage[^>]*?>(.*?)</rdf:Description>',
                    xmp_str,
                    re.DOTALL
                )
                for block in pi_blocks:
                    for name_match in re.findall(r'<rdf:li>([^<]+)</rdf:li>', block):
                        face_tags.append({
                            'name': name_match.strip(),
                            'source': 'XMP:PersonInImage'
                        })

            # Normalisera: ta bort dubbletter och tagg/kategori-prefix
            normalized = []
            seen = set()
            for ft in face_tags:
                name = ft['name']
                # Ta bort tagg/kategori-prefix (Personer/, etc.)
                if '|' in name or (('/' in name) and 'PersonInImage' not in ft.get('source', '')):
                    continue
                name = name.strip()
                if name and name not in seen:
                    seen.add(name)
                    normalized.append(ft)
            face_tags = normalized
        except Exception as e:
            print(f"Error extracting face tags: {e}")
        
        return face_tags
    
    def _extract_keywords(self, exif_dict: Dict, xmp_bytes: bytes = b"", exiftool_fields: Dict = None) -> List[str]:
        """Extraherar keywords/taggar från EXIF/XMP."""
        keywords: List[str] = []
        try:
            # IPTC Keywords
            iptc = exif_dict.get("Iptc", {})
            if iptc:
                for key, value in iptc.items():
                    if isinstance(value, (list, tuple)):
                        for item in value:
                            if isinstance(item, bytes):
                                keywords.append(item.decode('utf-8', errors='ignore'))
                    elif isinstance(value, bytes):
                        keywords.append(value.decode('utf-8', errors='ignore'))

            # XMP Keywords i UserComment
            user_comment = exif_dict.get("Exif", {}).get(piexif.ExifIFD.UserComment, b"")
            if user_comment and b'<dc:subject>' in user_comment:
                user_str = user_comment.decode('utf-8', errors='ignore')
                keywords.extend(re.findall(r'<rdf:li>([^<]+)</rdf:li>', user_str))

            # XMP i filen
            if xmp_bytes:
                blocks = re.findall(br'<dc:subject>\s*<rdf:Bag>(.*?)</rdf:Bag>', xmp_bytes, re.DOTALL)
                for block in blocks:
                    for raw_kw in re.findall(br'<rdf:li>([^<]+)</rdf:li>', block):
                        kw = self._decode_xmp_string(raw_kw)
                        keywords.append(kw)

                # Lightroom/DigiKam hierarkiska etiketter
                hierarchical_blocks = re.findall(br'<lr:hierarchicalSubject>\s*<rdf:Bag>(.*?)</rdf:Bag>', xmp_bytes, re.DOTALL)
                for block in hierarchical_blocks:
                    for raw_kw in re.findall(br'<rdf:li>([^<]+)</rdf:li>', block):
                        kw = self._decode_xmp_string(raw_kw)
                        keywords.append(kw)

            # ExifTool-fält som fallback/komplement
            exiftool_fields = exiftool_fields or {}
            for key in ('Subject', 'Keywords', 'HierarchicalSubject', 'XMP:Subject', 'IPTC:Keywords', 'XMP-lr:HierarchicalSubject'):
                value = exiftool_fields.get(key)
                if isinstance(value, list):
                    keywords.extend([str(v) for v in value if str(v).strip()])
                elif isinstance(value, str) and value.strip():
                    keywords.append(value.strip())
        except Exception as e:
            print(f"Error extracting keywords: {e}")

        # Ta bort dubbletter och normalisera
        cleaned: List[str] = []
        seen = set()
        for k in keywords:
            nk = k.strip()
            if nk and nk not in seen:
                seen.add(nk)
                cleaned.append(nk)
        return cleaned
    
    def _extract_metadata(self, exif_dict: Dict, xmp_bytes: bytes = b"", exiftool_fields: Dict = None) -> Dict:
        """Extraherar generell metadata"""
        metadata = {}
        try:
            zeroth = exif_dict.get("0th", {})
            exif = exif_dict.get("Exif", {})
            
            # Datum
            if piexif.ExifIFD.DateTimeOriginal in exif:
                date_bytes = exif[piexif.ExifIFD.DateTimeOriginal]
                metadata['date_taken'] = date_bytes.decode('utf-8', errors='ignore')
            
            # Beskrivning
            if piexif.ImageIFD.ImageDescription in zeroth:
                desc = zeroth[piexif.ImageIFD.ImageDescription]
                metadata['description'] = desc.decode('utf-8', errors='ignore')

            # XMP Titel/Beskrivning
            if xmp_bytes:
                for raw, key in (
                    (re.search(br'<dc:title>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]+)</rdf:li>', xmp_bytes, re.DOTALL), 'title'),
                    (re.search(br'<dc:description>\s*<rdf:Alt>\s*<rdf:li[^>]*>([^<]+)</rdf:li>', xmp_bytes, re.DOTALL), 'description'),
                ):
                    if raw:
                        val = self._decode_xmp_string(raw.group(1))
                        metadata[key] = val.strip()
            
            # Artist/Copyright
            if piexif.ImageIFD.Artist in zeroth:
                artist = zeroth[piexif.ImageIFD.Artist]
                metadata['artist'] = artist.decode('utf-8', errors='ignore')
                if not metadata.get('photographer'):
                    metadata['photographer'] = metadata['artist']
            
            if piexif.ImageIFD.Copyright in zeroth:
                copyright_text = zeroth[piexif.ImageIFD.Copyright]
                metadata['copyright'] = copyright_text.decode('utf-8', errors='ignore')
            
            # Titel
            if piexif.ImageIFD.DocumentName in zeroth:
                title = zeroth[piexif.ImageIFD.DocumentName]
                metadata['title'] = title.decode('utf-8', errors='ignore')

            if xmp_bytes:
                xmp_creator_match = re.search(br'<dc:creator>\s*<rdf:Seq>\s*<rdf:li>([^<]+)</rdf:li>', xmp_bytes, re.DOTALL)
                if xmp_creator_match:
                    creator_value = self._decode_xmp_string(xmp_creator_match.group(1)).strip()
                    if creator_value:
                        metadata['creator'] = creator_value
                        metadata['photographer'] = creator_value

            exiftool_fields = exiftool_fields or {}
            creator_value = exiftool_fields.get('Creator') or exiftool_fields.get('XMP:Creator')
            if isinstance(creator_value, list):
                creator_value = creator_value[0] if creator_value else ''
            if isinstance(creator_value, str) and creator_value.strip():
                metadata['creator'] = creator_value.strip()
                metadata['photographer'] = creator_value.strip()

            byline_value = exiftool_fields.get('By-line') or exiftool_fields.get('IPTC:By-line')
            if isinstance(byline_value, list):
                byline_value = byline_value[0] if byline_value else ''
            if isinstance(byline_value, str) and byline_value.strip() and not metadata.get('photographer'):
                metadata['photographer'] = byline_value.strip()
                metadata['creator'] = byline_value.strip()
                
        except Exception as e:
            print(f"Error extracting metadata: {e}")
        
        return metadata
    
    def _extract_camera_info(self, exif_dict: Dict) -> Dict:
        """Extraherar kamerainformation"""
        camera = {}
        
        try:
            zeroth = exif_dict.get("0th", {})
            exif = exif_dict.get("Exif", {})
            
            # Kamera make & model
            if piexif.ImageIFD.Make in zeroth:
                camera['make'] = zeroth[piexif.ImageIFD.Make].decode('utf-8', errors='ignore')
            if piexif.ImageIFD.Model in zeroth:
                camera['model'] = zeroth[piexif.ImageIFD.Model].decode('utf-8', errors='ignore')
            
            # Lins
            if piexif.ExifIFD.LensModel in exif:
                camera['lens'] = exif[piexif.ExifIFD.LensModel].decode('utf-8', errors='ignore')
            
            # Inställningar
            if piexif.ExifIFD.FNumber in exif:
                f_num = exif[piexif.ExifIFD.FNumber]
                camera['aperture'] = f"f/{f_num[0]/f_num[1]:.1f}"
            
            if piexif.ExifIFD.ExposureTime in exif:
                exp = exif[piexif.ExifIFD.ExposureTime]
                camera['shutter_speed'] = f"{exp[0]}/{exp[1]}"
            
            if piexif.ExifIFD.ISOSpeedRatings in exif:
                camera['iso'] = exif[piexif.ExifIFD.ISOSpeedRatings]
            
            if piexif.ExifIFD.FocalLength in exif:
                focal = exif[piexif.ExifIFD.FocalLength]
                camera['focal_length'] = f"{focal[0]/focal[1]:.0f}mm"
                
        except Exception as e:
            print(f"Error extracting camera info: {e}")
        
        return camera
    
    def _extract_gps(self, exif_dict: Dict) -> Optional[Dict]:
        """Extraherar GPS-koordinater"""
        try:
            gps = exif_dict.get("GPS", {})
            if not gps:
                return None
            
            # Kolla om vi har koordinater
            if piexif.GPSIFD.GPSLatitude not in gps or piexif.GPSIFD.GPSLongitude not in gps:
                return None
            
            # Konvertera från EXIF-format till decimal
            lat = self._convert_to_degrees(gps[piexif.GPSIFD.GPSLatitude])
            lon = self._convert_to_degrees(gps[piexif.GPSIFD.GPSLongitude])
            
            # Kolla nord/syd och öst/väst
            lat_ref = gps.get(piexif.GPSIFD.GPSLatitudeRef, b'N').decode('utf-8')
            lon_ref = gps.get(piexif.GPSIFD.GPSLongitudeRef, b'E').decode('utf-8')
            
            if lat_ref == 'S':
                lat = -lat
            if lon_ref == 'W':
                lon = -lon
            
            result = {
                'latitude': lat,
                'longitude': lon
            }
            
            # Altitude om det finns
            if piexif.GPSIFD.GPSAltitude in gps:
                alt = gps[piexif.GPSIFD.GPSAltitude]
                result['altitude'] = alt[0] / alt[1]
            
            return result
            
        except Exception as e:
            print(f"Error extracting GPS: {e}")
            return None
    
    def _convert_to_degrees(self, value) -> float:
        """Konvertera GPS från EXIF-format (grader, minuter, sekunder) till decimal"""
        d = value[0][0] / value[0][1]
        m = value[1][0] / value[1][1]
        s = value[2][0] / value[2][1]
        return d + (m / 60.0) + (s / 3600.0)
    
    def _safe_exif_dict(self, exif_dict: Dict) -> Dict:
        """Konvertera EXIF dict till JSON-säker format"""
        safe = {}
        for ifd_name, ifd_dict in exif_dict.items():
            if isinstance(ifd_dict, dict):
                safe[ifd_name] = {}
                for tag, value in ifd_dict.items():
                    try:
                        if isinstance(value, bytes):
                            safe[ifd_name][str(tag)] = value.decode('utf-8', errors='ignore')
                        elif isinstance(value, (list, tuple)):
                            safe[ifd_name][str(tag)] = str(value)
                        else:
                            safe[ifd_name][str(tag)] = str(value)
                    except:
                        safe[ifd_name][str(tag)] = "<binary>"
        return safe
    
    def write_keywords(self, image_path: str, keywords: List[str], backup: bool = True, photographer: str = "") -> bool:
        """
        Skriver keywords till bild via exiftool eller piexif fallback
        
        Args:
            image_path: Sökväg till bildfil
            keywords: Lista med keywords
            backup: Om backup ska skapas (rekommenderat)
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            # Försök med exiftool först (bättre XMP support)
            if self._has_exiftool():
                return self._write_keywords_exiftool(image_path, keywords, photographer)
            else:
                print(f"exiftool not found, using piexif fallback...")
                return self._write_keywords_piexif(image_path, keywords, photographer)
            
        except Exception as e:
            print(f"Error writing keywords to {image_path}: {e}")
            return False
    
    def _write_keywords_exiftool(self, image_path: str, keywords: List[str], photographer: str = "") -> bool:
        """Write keywords using exiftool (better XMP support)"""
        try:
            normalized_keywords = []
            seen = set()
            for keyword in keywords or []:
                value = str(keyword).strip()
                if value and value not in seen:
                    seen.add(value)
                    normalized_keywords.append(value)

            cmd = ['exiftool', '-overwrite_original']

            # Rensa befintliga fält innan skrivning
            cmd.extend([
                '-XMP:Subject=',
                '-IPTC:Keywords=',
                '-XMP-lr:HierarchicalSubject='
            ])

            for keyword in normalized_keywords:
                cmd.append(f'-XMP:Subject+={keyword}')
                cmd.append(f'-IPTC:Keywords+={keyword}')
                cmd.append(f'-XMP-lr:HierarchicalSubject+={keyword}')

            photographer_value = str(photographer or '').strip()
            if photographer_value:
                cmd.extend([
                    '-XMP:Creator=',
                    '-IPTC:By-line=',
                    f'-XMP:Creator={photographer_value}',
                    f'-IPTC:By-line={photographer_value}'
                ])

            cmd.append(image_path)
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
            
        except Exception as e:
            print(f"exiftool keywords write failed: {e}")
            return False
    
    def _write_keywords_piexif(self, image_path: str, keywords: List[str], photographer: str = "") -> bool:
        """Write keywords using piexif (fallback)"""
        try:
            # Läs befintlig EXIF
            exif_dict = piexif.load(image_path)
            
            # IPTC är bäst för keywords, men piexif har begränsat IPTC-stöd
            # Vi använder UserComment som fallback
            keywords_str = ", ".join(keywords)
            
            # Lägg till i UserComment (XMP-style)
            xmp_keywords = '<dc:subject><rdf:Bag>' + ''.join([f'<rdf:li>{k}</rdf:li>' for k in keywords]) + '</rdf:Bag></dc:subject>'
            
            if "Exif" not in exif_dict:
                exif_dict["Exif"] = {}

            if "0th" not in exif_dict:
                exif_dict["0th"] = {}
            
            exif_dict["Exif"][piexif.ExifIFD.UserComment] = xmp_keywords.encode('utf-8')

            photographer_value = str(photographer or '').strip()
            if photographer_value:
                exif_dict["0th"][piexif.ImageIFD.Artist] = photographer_value.encode('utf-8')
            
            # Skriv tillbaka
            exif_bytes = piexif.dump(exif_dict)
            piexif.insert(exif_bytes, image_path)
            
            return True
            
        except Exception as e:
            print(f"piexif keywords write failed: {e}")
            return False
    
    def write_face_tags(self, image_path: str, face_tags: List[Dict], backup: bool = True) -> bool:
        """
        Skriver face tags till bild via exiftool för MWG-Regions support
        
        Args:
            image_path: Sökväg till bildfil
            face_tags: Lista med {'name': str, 'x': float, 'y': float, 'width': float, 'height': float}
                      Coordinates in 0-100 format (frontend), we convert to 0-1 for XMP
            backup: Om backup ska skapas
        
        Returns:
            bool: Success status
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            # Kolla om exiftool finns
            if not self._has_exiftool():
                print(f"Warning: exiftool not found. Falling back to piexif for keywords only.")
                return self._write_face_tags_piexif_fallback(image_path, face_tags, backup=False)
            
            # Konvertera face_tags från 0-100 frontend-format till 0-1 XMP-format
            regions = []
            for i, tag in enumerate(face_tags):
                name = tag.get('name', '')
                if not name:
                    continue
                
                # Get coordinates in 0-100, convert to 0-1
                x = tag.get('x', 0) / 100.0
                y = tag.get('y', 0) / 100.0
                width = tag.get('width', 20) / 100.0
                height = tag.get('height', 20) / 100.0
                
                # Build XMP structure for this region
                # mwg-rs:Region index and content
                regions.append({
                    'index': i + 1,
                    'name': name,
                    'type': 'Face',
                    'x': f"{x:.4f}",
                    'y': f"{y:.4f}",
                    'w': f"{width:.4f}",
                    'h': f"{height:.4f}"
                })
            
            # Build exiftool command to write MWG-Regions
            cmd = ['exiftool', '-overwrite_original']
            
            # 1. Clear old regions first
            cmd.append('-Xmp.mwg-rs.Regions=')
            
            # 2. Add new regions
            for region in regions:
                idx = region['index']
                # Each region entry in the bag
                base = f'Xmp.mwg-rs.Regions'
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Name={region["name"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Type={region["type"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Area/stArea:x={region["x"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Area/stArea:y={region["y"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Area/stArea:w={region["w"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Area/stArea:h={region["h"]}')
                cmd.append(f'-{base}[{idx}]/mwg-rs:Region/mwg-rs:Area/stArea:unit=normalized')
            
            # 3. Also add PersonInImage for compatibility (names only, no coordinates)
            # This is for apps that only read PersonInImage
            person_names = [tag['name'] for tag in face_tags if tag.get('name')]
            if person_names:
                # Clear old PersonInImage
                cmd.append('-XMP:PersonInImage=')
                # Add new ones
                person_xmp = ''.join([f'<rdf:li>{name}</rdf:li>' for name in person_names])
                cmd.append(f'-XMP:PersonInImage=<rdf:Bag>{person_xmp}</rdf:Bag>')
            
            # 4. Image file path
            cmd.append(image_path)
            
            # Execute exiftool
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                return True
            else:
                print(f"exiftool error: {result.stderr}")
                return False
            
        except Exception as e:
            print(f"Error writing face tags to {image_path}: {e}")
            return False
    
    def _write_face_tags_piexif_fallback(self, image_path: str, face_tags: List[Dict], backup: bool = True) -> bool:
        """
        Fallback to piexif if exiftool not available.
        Only writes PersonInImage (no coordinates via MWG-Regions).
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            exif_dict = piexif.load(image_path)
            
            # Create XMP PersonInImage
            person_names = [tag['name'] for tag in face_tags if tag.get('name')]
            persons_xmp = '<XMP:PersonInImage><rdf:Bag>' + ''.join([f'<rdf:li>{name}</rdf:li>' for name in person_names]) + '</rdf:Bag></XMP:PersonInImage>'
            
            if "Exif" not in exif_dict:
                exif_dict["Exif"] = {}
            
            # Combine with existing UserComment if it exists
            existing = exif_dict["Exif"].get(piexif.ExifIFD.UserComment, b"").decode('utf-8', errors='ignore')
            new_comment = existing + persons_xmp
            
            exif_dict["Exif"][piexif.ExifIFD.UserComment] = new_comment.encode('utf-8')
            
            exif_bytes = piexif.dump(exif_dict)
            piexif.insert(exif_bytes, image_path)
            
            return True
            
        except Exception as e:
            print(f"Error in piexif fallback: {e}")
            return False
    
    def _has_exiftool(self) -> bool:
        """Check if exiftool is available in PATH"""
        try:
            subprocess.run(['exiftool', '-ver'], capture_output=True, timeout=2)
            return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def remove_all_metadata(self, image_path: str, backup: bool = True) -> bool:
        """
        Tar bort all EXIF-metadata (för privacy)
        
        Args:
            image_path: Sökväg till bildfil
            backup: Om backup ska skapas
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            piexif.remove(image_path)
            return True
            
        except Exception as e:
            print(f"Error removing metadata from {image_path}: {e}")
            return False
    
    def copy_metadata(self, source_path: str, target_path: str) -> bool:
        """
        Kopierar metadata från en bild till en annan
        
        Args:
            source_path: Källbild
            target_path: Målbild
        """
        try:
            exif_dict = piexif.load(source_path)
            exif_bytes = piexif.dump(exif_dict)
            piexif.insert(exif_bytes, target_path)
            return True
            
        except Exception as e:
            print(f"Error copying metadata: {e}")
            return False
    
    def _create_backup(self, image_path: str) -> str:
        """Skapar backup av originalbild"""
        filename = os.path.basename(image_path)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{timestamp}_{filename}"
        backup_path = os.path.join(self.backup_dir, backup_filename)
        
        shutil.copy2(image_path, backup_path)
        return backup_path
    
    def batch_process(self, image_paths: List[str], operation: str, **kwargs) -> Dict[str, bool]:
        """
        Batch-process flera bilder
        
        Args:
            image_paths: Lista med bildvägar
            operation: 'read', 'write_keywords', 'write_face_tags', 'remove_metadata', etc.
            **kwargs: Parametrar för operationen
        
        Returns:
            Dict med {image_path: success_bool}
        """
        results = {}
        
        for image_path in image_paths:
            try:
                if operation == 'read':
                    results[image_path] = self.read_exif(image_path)
                elif operation == 'write_keywords':
                    results[image_path] = self.write_keywords(
                        image_path,
                        kwargs.get('keywords', []),
                        kwargs.get('backup', True),
                        kwargs.get('photographer', '')
                    )
                elif operation == 'write_metadata':
                    results[image_path] = self.write_keywords(
                        image_path,
                        kwargs.get('keywords', []),
                        kwargs.get('backup', True),
                        kwargs.get('photographer', '')
                    )
                elif operation == 'write_face_tags':
                    results[image_path] = self.write_face_tags(image_path, kwargs.get('face_tags', []))
                elif operation == 'remove_metadata':
                    results[image_path] = self.remove_all_metadata(image_path)
                else:
                    results[image_path] = False
            except Exception as e:
                print(f"Batch error on {image_path}: {e}")
                results[image_path] = False
        
        return results
    
    def verify_mwg_regions(self, image_path: str) -> Dict:
        """
        Verifiera att MWG-regioner skrevs korrekt
        
        Läser metadata igen och returnerar regions med human-readable format
        """
        exif_data = self.read_exif(image_path)
        face_tags = exif_data.get('face_tags', [])
        
        result = {
            'file': image_path,
            'total_regions': len(face_tags),
            'regions': []
        }
        
        for tag in face_tags:
            region = {
                'name': tag.get('name', 'Unknown'),
                'source': tag.get('source', 'Unknown'),
                'has_coordinates': 'x' in tag and 'y' in tag,
            }
            if 'x' in tag:
                region['x'] = f"{tag['x']:.1f}%"
                region['y'] = f"{tag['y']:.1f}%"
                region['width'] = f"{tag['width']:.1f}%"
                region['height'] = f"{tag['height']:.1f}%"
            result['regions'].append(region)
        
        return result


# Test-funktioner
if __name__ == "__main__":
    manager = ExifManager()
    
    # Exempel på användning:
    # 1. Läs EXIF med MWG-regioner
    # exif_data = manager.read_exif("test_image.jpg")
    # print("Face tags with coordinates:")
    # for tag in exif_data.get('face_tags', []):
    #     print(f"  {tag['name']}: ({tag.get('x', 'N/A')}, {tag.get('y', 'N/A')}) - {tag.get('width', 'N/A')}x{tag.get('height', 'N/A')}")
    # print(json.dumps(exif_data, indent=2))
    
    # 2. Skriv face tags med MWG-regioner
    # manager.write_face_tags("test_image.jpg", [
    #     {"name": "Anders Nilsson", "x": 40, "y": 30, "width": 20, "height": 20},
    #     {"name": "Brita Johansson", "x": 60, "y": 35, "width": 18, "height": 22}
    # ])
    
    # 3. Skriv keywords
    # manager.write_keywords("test_image.jpg", ["Porträtt", "1910", "Studio"])
    
    print("EXIF Manager loaded. Ready to use.")
    print("Features:")
    print("  - MWG-Regions support (Lightroom/DigiKam compatible)")
    print("  - Face tag coordinates (0-100 format)")
    print("  - Keywords via XMP/IPTC")
    print("  - Full round-trip compatibility")
