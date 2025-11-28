import AppRouter from "./AppRouter";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SalesPromoProvider } from "./features/salespromo/SalesPromoContext";


export default function App() {
  return (
    <SalesPromoProvider>
      <AppRouter />
      <ToastContainer position="bottom-right" autoClose={3500} />
    </SalesPromoProvider>
  );
}
