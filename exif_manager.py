"""
EXIF Manager - Hanterar EXIF-metadata, face tags och keywords med piexif
"""

import piexif
from PIL import Image
import json
import os
from typing import Dict, List, Optional, Tuple
import shutil
from datetime import datetime
import re


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
            
            result = {
                'face_tags': self._extract_face_tags(exif_dict, xmp_data),
                'keywords': self._extract_keywords(exif_dict, xmp_data),
                'metadata': self._extract_metadata(exif_dict, xmp_data),
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
    
    def _extract_face_tags(self, exif_dict: Dict, xmp_bytes: bytes = b"") -> List[Dict]:
        """
        Extraherar face tags från XMP-data
        
        Söker efter:
        - MWG Regions (mwg-rs:Name)
        - Microsoft Photo RegionInfo (MPReg:PersonDisplayName)
        - XMP PersonInImage
        """
        face_tags = []
        
        # Kolla XMP-data
        try:
            if xmp_bytes:
                # 1. MWG Regions: mwg-rs:Name="Person Name" (Lightroom, digiKam)
                for match in re.finditer(br'mwg-rs:Name="([^"]+)"', xmp_bytes):
                    name_bytes = match.group(1)
                    person = self._decode_xmp_string(name_bytes)
                    face_tags.append({
                        'name': person.strip(),
                        'source': 'XMP:MWG-Regions'
                    })
                
                # 2. Microsoft Photo: MPReg:PersonDisplayName="Person Name"
                for match in re.finditer(br'MPReg:PersonDisplayName="([^"]+)"', xmp_bytes):
                    name_bytes = match.group(1)
                    person = self._decode_xmp_string(name_bytes)
                    face_tags.append({
                        'name': person.strip(),
                        'source': 'XMP:Microsoft-RegionInfo'
                    })
                
                # 3. Fallback: XMP PersonInImage <rdf:li>Person Name</rdf:li>
                pi_blocks = re.findall(br'<rdf:Description[^>]*?PersonInImage[^>]*?>(.*?)</rdf:Description>', xmp_bytes, re.DOTALL)
                for block in pi_blocks:
                    for pb in re.findall(br'<rdf:li>([^<]+)</rdf:li>', block):
                        person = self._decode_xmp_string(pb)
                        face_tags.append({
                            'name': person.strip(),
                            'source': 'XMP:PersonInImage'
                        })

            # Normalisera: ta bort dubbletter och tagg/kategori-prefix
            normalized = []
            seen = set()
            for ft in face_tags:
                name = ft['name']
                # Ta bort tagg/kategori-prefix (Personer/, etc.)
                if '|' in name or '/' in name:
                    continue
                name = name.strip()
                if name and name not in seen:
                    seen.add(name)
                    normalized.append({ 'name': name, 'source': ft['source'] })
            face_tags = normalized
        except Exception as e:
            print(f"Error extracting face tags: {e}")
        
        return face_tags
    
    def _extract_keywords(self, exif_dict: Dict, xmp_bytes: bytes = b"") -> List[str]:
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
        except Exception as e:
            print(f"Error extracting keywords: {e}")

        # Ta bort dubbletter och normalisera
        cleaned: List[str] = []
        seen = set()
        for k in keywords:
            nk = k.strip()
            if '|' in nk:
                nk = nk.split('|')[-1].strip()
            if '/' in nk:
                nk = nk.split('/')[-1].strip()
            if nk and nk not in seen:
                seen.add(nk)
                cleaned.append(nk)
        return cleaned
    
    def _extract_metadata(self, exif_dict: Dict, xmp_bytes: bytes = b"") -> Dict:
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
            
            if piexif.ImageIFD.Copyright in zeroth:
                copyright_text = zeroth[piexif.ImageIFD.Copyright]
                metadata['copyright'] = copyright_text.decode('utf-8', errors='ignore')
            
            # Titel
            if piexif.ImageIFD.DocumentName in zeroth:
                title = zeroth[piexif.ImageIFD.DocumentName]
                metadata['title'] = title.decode('utf-8', errors='ignore')
                
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
    
    def write_keywords(self, image_path: str, keywords: List[str], backup: bool = True) -> bool:
        """
        Skriver keywords till bild
        
        Args:
            image_path: Sökväg till bildfil
            keywords: Lista med keywords
            backup: Om backup ska skapas (rekommenderat)
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            # Läs befintlig EXIF
            exif_dict = piexif.load(image_path)
            
            # IPTC är bäst för keywords, men piexif har begränsat IPTC-stöd
            # Vi använder UserComment som fallback
            keywords_str = ", ".join(keywords)
            
            # Lägg till i UserComment (XMP-style)
            xmp_keywords = '<dc:subject><rdf:Bag>' + ''.join([f'<rdf:li>{k}</rdf:li>' for k in keywords]) + '</rdf:Bag></dc:subject>'
            
            if "Exif" not in exif_dict:
                exif_dict["Exif"] = {}
            
            exif_dict["Exif"][piexif.ExifIFD.UserComment] = xmp_keywords.encode('utf-8')
            
            # Skriv tillbaka
            exif_bytes = piexif.dump(exif_dict)
            piexif.insert(exif_bytes, image_path)
            
            return True
            
        except Exception as e:
            print(f"Error writing keywords to {image_path}: {e}")
            return False
    
    def write_face_tags(self, image_path: str, face_tags: List[Dict], backup: bool = True) -> bool:
        """
        Skriver face tags till bild
        
        Args:
            image_path: Sökväg till bildfil
            face_tags: Lista med {'name': str, 'x': float, 'y': float, 'width': float, 'height': float}
            backup: Om backup ska skapas
        """
        try:
            if backup:
                self._create_backup(image_path)
            
            exif_dict = piexif.load(image_path)
            
            # Skapa XMP PersonInImage
            persons_xmp = '<PersonInImage><rdf:Bag>' + ''.join([f'<rdf:li>{ft["name"]}</rdf:li>' for ft in face_tags]) + '</rdf:Bag></PersonInImage>'
            
            # Lägg även till region info (Microsoft Photo format)
            # Detta är mer komplext och kräver XML-generering
            # För nu, använd bara PersonInImage
            
            if "Exif" not in exif_dict:
                exif_dict["Exif"] = {}
            
            # Kombinera med befintlig UserComment om det finns
            existing = exif_dict["Exif"].get(piexif.ExifIFD.UserComment, b"").decode('utf-8', errors='ignore')
            new_comment = existing + persons_xmp
            
            exif_dict["Exif"][piexif.ExifIFD.UserComment] = new_comment.encode('utf-8')
            
            exif_bytes = piexif.dump(exif_dict)
            piexif.insert(exif_bytes, image_path)
            
            return True
            
        except Exception as e:
            print(f"Error writing face tags to {image_path}: {e}")
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
                    results[image_path] = self.write_keywords(image_path, kwargs.get('keywords', []))
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


# Test-funktioner
if __name__ == "__main__":
    manager = ExifManager()
    
    # Exempel på användning:
    # exif_data = manager.read_exif("test_image.jpg")
    # print(json.dumps(exif_data, indent=2))
    
    # manager.write_keywords("test_image.jpg", ["Porträtt", "1910", "Studio"])
    # manager.write_face_tags("test_image.jpg", [
    #     {"name": "Anders Nilsson", "x": 40, "y": 30, "width": 20, "height": 20}
    # ])
    
    print("EXIF Manager loaded. Ready to use.")
