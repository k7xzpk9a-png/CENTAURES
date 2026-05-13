import cv2
import numpy as np

# Global variables for mouse handling
clicked_points = []

def to_hex_obfuscated(value):
    """Converts a physical value to the specific NH90 dat hex format"""
    decimal_val = int(round((value * 1200) + 24328))
    # Handle two's complement for negative values
    if decimal_val < 0:
        decimal_val = (1 << 32) + decimal_val
    return hex(decimal_val)[2:].lower()

def mouse_callback(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN:
        clicked_points.append((x, y))
        # Draw a small circle to show where you clicked
        cv2.circle(img_display, (x, y), 5, (0, 0, 255), -1)
        cv2.imshow("Digitizer - Click points then press ESC", img_display)

# 1. Inputs
img_path = input("Enter the path to your PNG file (e.g., graph.png): ")
oat_min = float(input("Enter OAT Min (e.g., -40): "))
oat_max = float(input("Enter OAT Max (e.g., 50): "))
trans_min = float(input("Enter Transfer Value at BOTTOM line: "))
trans_max = float(input("Enter Transfer Value at TOP line: "))
current_pa = float(input("Which PA curve are you digitizing? (e.g., -2000): "))

# 2. Load Image
img = cv2.imread(img_path)
if img is None:
    print("Error: Could not load image.")
    exit()

img_display = img.copy()
cv2.namedWindow("Digitizer - Click points then press ESC", cv2.WINDOW_NORMAL)
cv2.setMouseCallback("Digitizer - Click points then press ESC", mouse_callback)

# 3. Calibration Phase
print("\n--- CALIBRATION ---")
print("1. Click the intersection of OAT Min and the BOTTOM altitude line.")
print("2. Click the intersection of OAT Max and the TOP altitude line.")
print("Press any key once both calibration points are clicked.")

while len(clicked_points) < 2:
    cv2.imshow("Digitizer - Click points then press ESC", img_display)
    if cv2.waitKey(1) & 0xFF == 27: break

cal_p1 = clicked_points[0] # Bottom-Left
cal_p2 = clicked_points[1] # Top-Right
clicked_points = [] # Clear for curve digitization

# 4. Digitization Phase
print("\n--- DIGITIZING CURVE ---")
print(f"Click along the {current_pa}ft curve from Left to Right.")
print("Press ESC when finished.")

while True:
    cv2.imshow("Digitizer - Click points then press ESC", img_display)
    key = cv2.waitKey(1) & 0xFF
    if key == 27: # ESC key
        break

cv2.destroyAllWindows()

# 5. Conversion Logic
# Map pixels to physical values
def map_val(px, py):
    # Calculate OAT (X Axis)
    oat = oat_min + (px - cal_p1[0]) / (cal_p2[0] - cal_p1[0]) * (oat_max - oat_min)
    # Calculate Transfer Value (Y Axis)
    # Note: py decreases as we go up, so we use (cal_p1 - py)
    ratio = (cal_p1[1] - py) / (cal_p1[1] - cal_p2[1])
    trans = trans_min + ratio * (trans_max - trans_min)
    return oat, trans

# 6. Generate DAT Format Output
header_hex = to_hex_obfuscated(current_pa / 1000.0)
oat_list = []
trans_list = []

for p in clicked_points:
    oat_val, trans_val = map_val(p[0], p[1])
    oat_list.append(to_hex_obfuscated(oat_val))
    trans_list.append(to_hex_obfuscated(trans_val))

print("\n--- COPY THESE ROWS INTO YOUR .DAT FILE ---")
# Line 1: Header (PA) ; OAT Axis
print(f"{header_hex};{';'.join(oat_list)}")
# Line 2: Header (PA) ; Transfer Values
print(f"{header_hex};{';'.join(trans_list)}")