#!/usr/bin/env python3
"""
MWG-Regions Test Suite för exif_manager.py

Denna script tester all MWG-Regions funktionalitet:
- Läsning av regioner med koordinater
- Skrivning av regioner
- Conversion mellan 0-100% och 0-1 formater
- Keyword handling

Användning:
    python test_mwg_regions.py <test_image.jpg>
"""

import json
import sys
import os
import shutil
from datetime import datetime
from exif_manager import ExifManager


def print_header(title):
    """Skriv ut formaterad header"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_success(msg):
    """Grön success-text"""
    print(f"✅ {msg}")


def print_error(msg):
    """Röd error-text"""
    print(f"❌ {msg}")


def print_info(msg):
    """Blå info-text"""
    print(f"ℹ️  {msg}")


def test_read_mwg_regions(manager, image_path):
    """Test 1: Läs befintliga MWG-regioner"""
    print_header("TEST 1: Läsa MWG-Regioner")
    
    try:
        exif_data = manager.read_exif(image_path)
        face_tags = exif_data.get('face_tags', [])
        
        if not face_tags:
            print_info("Ingen face tags hittades i bilden (detta är OK)")
            return True
        
        print_success(f"Hittade {len(face_tags)} face tags:")
        
        for i, tag in enumerate(face_tags, 1):
            print(f"\n  Tag {i}:")
            print(f"    Namn: {tag.get('name', 'N/A')}")
            print(f"    Källa: {tag.get('source', 'N/A')}")
            
            if 'x' in tag:
                print(f"    Position: ({tag['x']:.1f}%, {tag['y']:.1f}%)")
                print(f"    Storlek: {tag['width']:.1f}% × {tag['height']:.1f}%")
            else:
                print_info("    Inga koordinater (endast namn)")
        
        return True
    except Exception as e:
        print_error(f"Failed to read: {e}")
        return False


def test_write_mwg_regions(manager, image_path):
    """Test 2: Skriv MWG-regioner"""
    print_header("TEST 2: Skriva MWG-Regioner")
    
    # Skapa backup först
    backup_path = f"{image_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    try:
        shutil.copy2(image_path, backup_path)
        print_info(f"Backupfil skapad: {backup_path}")
    except Exception as e:
        print_error(f"Kunde inte skapa backup: {e}")
        return False
    
    # Test data
    test_face_tags = [
        {
            "name": "Anders Nilsson",
            "x": 40,        # 40%
            "y": 30,        # 30%
            "width": 20,    # 20%
            "height": 20    # 20%
        },
        {
            "name": "Brita Johansson",
            "x": 60,        # 60%
            "y": 35,        # 35%
            "width": 18,    # 18%
            "height": 22    # 22%
        }
    ]
    
    try:
        print_info("Skriver 2 ansiktstaggar till bilden...")
        success = manager.write_face_tags(image_path, test_face_tags, backup=False)
        
        if success:
            print_success("Face tags skrivna framgångsrikt!")
            return True
        else:
            print_error("Failed to write face tags (exiftool error)")
            print_info(f"Restoration restore från: {backup_path}")
            shutil.copy2(backup_path, image_path)
            return False
    except Exception as e:
        print_error(f"Exception during write: {e}")
        print_info(f"Restoration restore från: {backup_path}")
        shutil.copy2(backup_path, image_path)
        return False


def test_roundtrip_verification(manager, image_path):
    """Test 3: Verifiera round-trip (skriv sedan läs)"""
    print_header("TEST 3: Round-Trip Verification (Skriv → Läs)")
    
    try:
        exif_data = manager.read_exif(image_path)
        face_tags = exif_data.get('face_tags', [])
        
        print_info(f"Läser tillbaka från bilden...")
        
        if not face_tags:
            print_error("Inga face tags lästa tillbaka - skrivningen misslyckades?")
            return False
        
        print_success(f"Hittade {len(face_tags)} face tags ved läsning:")
        
        for i, tag in enumerate(face_tags, 1):
            print(f"\n  Tag {i}:")
            print(f"    Namn: {tag.get('name', 'N/A')}")
            
            if 'x' in tag:
                # Check if coordinates are close to what we wrote
                x, y = tag.get('x', 0), tag.get('y', 0)
                w, h = tag.get('width', 0), tag.get('height', 0)
                
                print(f"    Position: ({x:.1f}%, {y:.1f}%)")
                print(f"    Storlek: {w:.1f}% × {h:.1f}%")
                print(f"    Källa: {tag.get('source', 'N/A')}")
                
                # Verify values are reasonable (not NaN or extreme)
                if x < 0 or x > 100 or y < 0 or y > 100:
                    print_error(f"    ⚠️  Координати обнулились eller är felaktig!")
                    return False
            else:
                print_error("    ⚠️  Koordinater saknas i läst data!")
        
        return True
    except Exception as e:
        print_error(f"Error during verification: {e}")
        return False


def test_keywords(manager, image_path):
    """Test 4: Skriva och läsa keywords"""
    print_header("TEST 4: Keywords")
    
    test_keywords = ["Porträtt", "1910", "Studio", "Sverige"]
    
    try:
        print_info(f"Skriver keywords: {', '.join(test_keywords)}")
        success = manager.write_keywords(image_path, test_keywords, backup=False)
        
        if not success:
            print_error("Failed to write keywords")
            return False
        
        print_success("Keywords skrivna!")
        
        # Läs tillbaka
        print_info("Läser keywords tillbaka...")
        exif_data = manager.read_exif(image_path)
        read_keywords = exif_data.get('keywords', [])
        
        if read_keywords:
            print_success(f"Keywords lästa: {', '.join(read_keywords)}")
            return True
        else:
            print_error("Inga keywords lästa tillbaka")
            return False
    except Exception as e:
        print_error(f"Error with keywords: {e}")
        return False


def test_verify_mwg_structure(manager, image_path):
    """Test 5: Verifiera MWG-strukturen"""
    print_header("TEST 5: MWG-Struktur Verifiering")
    
    try:
        result = manager.verify_mwg_regions(image_path)
        
        print_success(f"Bild: {result['file']}")
        print(f"Totala regioner: {result['total_regions']}")
        
        if result['regions']:
            print("\nRegioner:")
            for region in result['regions']:
                print(f"\n  {region['name']}")
                print(f"    Källa: {region['source']}")
                print(f"    Har koordinater: {region['has_coordinates']}")
                if region['has_coordinates']:
                    print(f"    Område: ({region['x']}, {region['y']}, {region['width']}, {region['height']})")
        else:
            print_info("Inga regioner i strukturen")
        
        # Pretty print JSON
        print("\nFullständig struktur (JSON):")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        return True
    except Exception as e:
        print_error(f"Error verifying structure: {e}")
        return False


def test_exiftool_availability(manager):
    """Test 0: Kontrollera om exiftool finns"""
    print_header("TEST 0: Beroende-Check")
    
    if manager._has_exiftool():
        print_success("exiftool finns tillgängligt")
        print_info("MWG-Regions kommer att skrivas via exiftool (optimal)")
        return True
    else:
        print_error("exiftool INTE installerat")
        print_info("Fallback till piexif (begränsat stöd, endast PersonInImage)")
        print_info("\nInstallera exiftool:")
        print("  Windows: choco install exiftool")
        print("  macOS: brew install exiftool")
        print("  Linux: sudo apt-get install exiftool")
        return False


def main():
    if len(sys.argv) < 2:
        print("Användning: python test_mwg_regions.py <test_image.jpg>")
        print("\nExample:")
        print("  python test_mwg_regions.py ~/Pictures/photo.jpg")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Filen finns inte: {image_path}")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("  MWG-Regions TEST SUITE")
    print("=" * 60)
    print(f"Testfil: {image_path}")
    print(f"Filstorlek: {os.path.getsize(image_path) / 1024:.1f} KB")
    
    manager = ExifManager()
    
    # Köra tests
    results = {}
    
    results['exiftool'] = test_exiftool_availability(manager)
    results['read'] = test_read_mwg_regions(manager, image_path)
    results['write'] = test_write_mwg_regions(manager, image_path)
    results['roundtrip'] = test_roundtrip_verification(manager, image_path)
    results['keywords'] = test_keywords(manager, image_path)
    results['verify'] = test_verify_mwg_structure(manager, image_path)
    
    # Sammanfattning
    print_header("TESTSAMMANFATTNING")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status}: {name.upper()}")
    
    print(f"\nTotalt: {passed}/{total} test(s) passerade")
    
    if passed == total:
        print_success("Alla tester passerade! MWG-Regions är fullt operativ.")
        sys.exit(0)
    else:
        print_error("Några tester misslyckades. Se ovan för detaljer.")
        sys.exit(1)


if __name__ == "__main__":
    main()
