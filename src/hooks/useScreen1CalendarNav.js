import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { writePersistedCalendarBack } from '../data/appointmentStateStore';

/** Screen1 upper-curve / date stamp → Calendar (persists back route for iOS PWA). */
export function useScreen1CalendarNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const from =
      typeof location.pathname === 'string' && location.pathname.startsWith('/')
        ? location.pathname
        : '/screen1';
    writePersistedCalendarBack(from);
    navigate('/calendar', { state: { from } });
  }, [navigate, location.pathname]);
}
