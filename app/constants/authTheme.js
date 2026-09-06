// Pre-login screens use a fixed palette rather than the toggleable theme:
// there is no staff member yet whose preference we could honour, and a login
// screen that flickers between light and dark on launch reads as a fault.
export default {
    background: '#25293C',
    surface: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.14)',
    accent: '#4b8fc8',
    accentPressed: '#3C82B4',
    onAccent: '#ffffff',
    textPrimary: '#F2F1F8',
    textSecondary: '#A9A7B8',
    error: '#EA5455',
    inputBackground: 'rgba(255, 255, 255, 0.05)',
};
