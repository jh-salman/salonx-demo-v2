import { useNavigate } from "react-router-dom";

const DynamicDate = () => {
  const navigate = useNavigate();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Thu"
  const dayNumber = today.getDate(); // e.g. 9

  return (
    <div onClick={() => navigate("/screen3")}>
      {dayName}
      <br />
      <p style={dayNumberStyle}>{dayNumber}</p>
    </div>
  );
};


const dayNumberStyle = {
  fontWeight: 'bold',
  margin: 0,
  cursor: 'pointer',
};

export default DynamicDate;
