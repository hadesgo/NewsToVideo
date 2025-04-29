import { Textbox } from 'fabric/node' // v6

export const initTxtbox = () => {
  Textbox.ownDefaults.splitByGrapheme = true
}
