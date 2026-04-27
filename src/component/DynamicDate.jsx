import { useNavigate } from "react-router-dom";

const DynamicDate = () => {
  const navigate = useNavigate();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Thu"
  const dayNumber = today.getDate(); // e.g. 9

  return (
    <div onClick={() => navigate("/screen3")} style={wrapperStyle}>
      {dayName}<br />
      <p style={dayNumberStyle}>{dayNumber}</p>
    </div>
  );
};


const wrapperStyle = {
  zIndex: "1000",
  position: "absolute",
  cursor: "pointer",
  top: "10px",
  right: "10px",
  fontSize: "16px",
  fontWeight: "bold",
  textAlign: "right",
  color: "#fff"
};

const dayNumberStyle = {
  fontWeight: "bold",
  paddingLeft: "10px",
  margin: 0,
  cursor: "pointer"
};

export default DynamicDate;
