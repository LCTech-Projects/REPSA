import { Footer } from "./Footer";
import { Frame1 } from "./Frame1";
import { Frame2 } from "./Frame2";
import { Frame3 } from "./Frame3";
import { Frame4 } from "./Frame4";
import { OnboardingModal } from "../../../components/modals/OnboardingModal";


const Home = () => {


  return (

    <section>
      <OnboardingModal />
      <Frame1 />
      <Frame2 />
      <Frame3 />
      <Frame4 />
      <Footer />
    </section>

  );
};

export default Home;
