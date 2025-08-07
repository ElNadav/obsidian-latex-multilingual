# find_layouts.py
import win32api

layouts = win32api.GetKeyboardLayoutList()
for layout in layouts:
  # The lower 16 bits are the language ID
  lang_id = layout & 0xFFFF
  print(f"Layout HKL: 0x{layout:08x} | Language ID: 0x{lang_id:04x}")
