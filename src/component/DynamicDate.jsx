import { useScreen1CalendarNav } from '../hooks/useScreen1CalendarNav';

const DynamicDate = () => {
  const openCalendar = useScreen1CalendarNav();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dayNumber = today.getDate();

  return (
    <button
      type="button"
      className="date-screen1"
      onClick={openCalendar}
      aria-label="Open calendar"
    >
      <span className="date-screen1__dow">{dayName}</span>
      <span className="date-screen1__num">{dayNumber}</span>
    </button>
  );
};

export default DynamicDate;
