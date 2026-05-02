import { createBrowserRouter } from "react-router-dom";
import Home from "../presentation/screen/Home";
import Screen1 from "../presentation/screen/Screen1";
import Screen2 from "../presentation/screen/Screen2";
import Screen3 from "../presentation/screen/Screen3";
import Climax from "../presentation/screen/Climax";
import Calendar from "../presentation/screen/Calendar";
import CheckOut from "../presentation/screen/CheckOut";
import Clients from "../presentation/screen/Clients";


export const router = createBrowserRouter([
  {
    path: "/",
    element:<Home/>
  },
  {
    path: "/screen1",
    element: <Screen1 />
  },
  {
    path: "/screen2",
    element: <Screen2 />
  },
  {
    path:"/screen3",
    element:<Calendar />
  },
  {
    path:"/climax",
    element:<Climax />
  },
  {
    path:"/calendar",
    element:<Calendar />
  },
  {
    path:"/checkout",
    element:<CheckOut />
  },
  {
    path:"/clients",
    element:<Clients />
  }
  
]);