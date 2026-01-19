import flatpanbake from '../assets/images/flatpanbake.jpg';
import confusedmeme from '../assets/images/confusedmeme.jpg';
import drupal_logo from '../assets/images/drupal_logo.png';
import empty_dining from '../assets/images/empty_dining.jpg';
import hot_tub from '../assets/images/hot_tub.jpg';
import historical_dress from '../assets/images/190111-historical-dress.JPG';
import crn_1992 from '../assets/images/1992-05-CRN.jpg';
import fathersday from '../assets/images/20160619-fathersday.jpg';
import jekyll_garden from '../assets/images/21-04-02-jekyll-garden.jpg';
import old_walnut from '../assets/images/88-e-walnut-st.jpg';
import windows_setup from '../assets/images/2019-09-14-win10-setup.jpg';

const imageMap: Record<string, { default: string }> = {
  'flatpanbake.jpg': flatpanbake as any,
  'confusedmeme.jpg': confusedmeme as any,
  'drupal_logo.png': drupal_logo as any,
  'empty_dining.jpg': empty_dining as any,
  'hot_tub.jpg': hot_tub as any,
  '190111-historical-dress.JPG': historical_dress as any,
  '1992-05-CRN.jpg': crn_1992 as any,
  '20160619-fathersday.jpg': fathersday as any,
  '21-04-02-jekyll-garden.jpg': jekyll_garden as any,
  '88-e-walnut-st.jpg': old_walnut as any,
  '2019-09-14-win10-setup.jpg': windows_setup as any,
};

export function getImagePath(imagePath: string): any {
  // Extract filename from path like "../../assets/images/flatpanbake.jpg"
  const filename = imagePath.split('/').pop();
  if (filename && imageMap[filename]) {
    return imageMap[filename];
  }
  return null;
}
