APP.FOVEATE

Main Page Controller 

- Navbar
    - Top Right Links
    - Profile Dropdown
    - Logo
    - Preview / Announcement 

- Authentication Handler 
    - Block/Show App UI based on user auth state 
    - Populate UI with User Information

LOAD ORDER

1. Load UI Shell Elements 
2. Check Auth State
3. Render Page Based on Auth State
4. Download Scene Data from Firestore DB 
5. Populate Foveate APP UI after scene data has been downloaded 
6. Download all static assets 
7. Turn off loading screen and fade in 3D App

AFTER LOAD ORDER

1. Watch all UI Elements and debounce output
2. Upload Debounced Output to Firebase DB
3. Update last edit timestamp 


