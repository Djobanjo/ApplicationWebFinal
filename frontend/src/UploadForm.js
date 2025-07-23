import React, { useState } from 'react';
import { useEffect } from 'react';
//import axios from 'axios'; pas utilisé mais la au cas ou
import './UploadForm.css'; // Import des styles CSS externes

const UploadForm = () => {
  // États pour stocker la validité des champs et leur contenu
  const [nom, setNom] = useState('');
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);
  const [passeport, setPasseport] = useState(null);

  const [photoStatus, setPhotoStatus] = useState('');
  const [signatureStatus, setSignatureStatus] = useState('');
  const [passeportStatus, setPasseportStatus] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}


  useEffect(() => {
    const savedNom = localStorage.getItem('nom');
    const savedPhoto = localStorage.getItem('photo');
    const savedSignature = localStorage.getItem('signature');
    const savedPasseport = localStorage.getItem('passeport');

    console.log("🔄 Chargement depuis localStorage:", {
    nom: savedNom,
    photo: savedPhoto?.substring(0, 50) + '...',
    signature: savedSignature?.substring(0, 50) + '...',
    passeport: savedPasseport?.substring(0, 50) + '...',
    });

    if (savedNom) setNom(savedNom);
    if (savedPhoto) setPhoto(dataURLtoFile(savedPhoto, 'photo.png'));
    if (savedSignature) setSignature(dataURLtoFile(savedSignature, 'signature.png'));
    if (savedPasseport) setPasseport(dataURLtoFile(savedPasseport, 'passeport.pdf'));
  }, []);


  // Vérifie les extensions valides pour chaque type de fichier
  const validExtensions = {
    photo: ['image/jpg', 'image/png','image/jpeg'],
    signature: ['image/jpg', 'image/png','image/jpeg'],
    passeport: ['application/pdf'],
  };

  

  // Fonction de mise à jour de l'état d'un fichier sélectionné
const handleFileChange = (e, type) => {
  const file = e.target.files[0];

  if (!file) {
    updateStatus(type, '', 'Aucun fichier sélectionné');
    updateFileState(type, null);
    localStorage.removeItem(type);
    return;
  }

  if (!validExtensions[type].includes(file.type)) {
    updateStatus(type, 'Format de fichier invalide', '');
    updateFileState(type, null);
    localStorage.removeItem(type);
    return;
  }

  updateFileState(type, file);
  updateStatus(type, '', `Fichier choisi : ${file.name}`);

  try {
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem(type, reader.result);
      console.log(`Fichier ${type} stocké en localStorage (${reader.result.substring(0,50)}...)`);
    };
    reader.onerror = (error) => {
      console.error("Erreur lors de la lecture du fichier :", error);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Exception lors de readAsDataURL :", error);
  }
};


  // Met à jour les messages d'état (erreur ou succès)
  const updateStatus = (type, error, success) => {
  const message = error || success;
  switch (type) {
    case 'photo': setPhotoStatus(message); break;
    case 'signature': setSignatureStatus(message); break;
    case 'passeport': setPasseportStatus(message); break;
    default: break;
  }
};


  // Met à jour le fichier sélectionné
  const updateFileState = (type, file) => {
    if (type === 'photo') setPhoto(file);
    if (type === 'signature') setSignature(file);
    if (type === 'passeport') setPasseport(file);
  };

  // Validation globale du formulaire
  const isFormValid = () => {
    return (
      nom.trim() &&
      photo &&
      signature &&
      passeport
    );
  };

  
  const API_URL = process.env.REACT_APP_API_URL;

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus('Envoi en cours...');

    // LOG : contenu du localStorage avant envoi
    console.log("Contenu localStorage AVANR envoi :", {
      nom: localStorage.getItem('nom'),
      photo: localStorage.getItem('photo')?.substring(0, 100) + '...', //tronqué
      signature: localStorage.getItem('signature')?.substring(0, 100) + '...',
    });


    const formData = new FormData();
    formData.append('nom', nom);
    formData.append('photo', photo);
    formData.append('signature', signature);
    formData.append('passeport', passeport);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setFormStatus('Documents téléchargés avec succès !');
        // 🧹 Vider les données du localStorage
        localStorage.removeItem('photo');
        localStorage.removeItem('signature');
        localStorage.removeItem('passeport');
        localStorage.removeItem('nom');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const errorText = await response.text();
        setFormStatus(`Erreur lors du téléchargement : ${errorText}`);
      }
    } catch (error) {
      setFormStatus(`Erreur réseau : ${error.message}`);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="upload-container">
      <h2>Téléversez vos documents</h2>
      <form onSubmit={handleSubmit}>
        {/* Champ texte : nom */}
        <div className="text-field">
          <label htmlFor="nom">Nom du demandeur</label>
          <input
            type="text"
            id="nom"
            value={nom}
            onChange={(e) => {
              setNom(e.target.value);
            localStorage.setItem('nom',e.target.value);
            }}
            placeholder="Entrez votre nom"
            required
            style={{ backgroundColor : 'beige', justifyContent: 'center'}}
          />
        </div> <br/>

        {/* Bloc : photo d'identité */}
        <div className="section">
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-person-square" viewBox="0 0 16 16">
  <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/>
  <path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1v-1c0-1-1-4-6-4s-6 3-6 4v1a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
</svg>
          <h3>Photo d'identité</h3>
          <p>Formats acceptés : <strong>.jpg, .jpeg, .png</strong></p>
          <label className="upload-btn" htmlFor="photoIdentite" >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-upload" viewBox="0 0 16 16">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
  </svg> Choisir un fichier
            <input
              id='photoIdentite'
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => handleFileChange(e, 'photo')}
              required
            />
          </label>
          <div className="upload-status">{photoStatus}</div>
        </div>

        {/* Bloc : signature */}
        <div className="section">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-image-alt" viewBox="0 0 16 16">
  <path d="M7 2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m4.225 4.053a.5.5 0 0 0-.577.093l-3.71 4.71-2.66-2.772a.5.5 0 0 0-.63.062L.002 13v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5z"/>
</svg>
          <h3>Photo de la signature</h3>
          <p>Formats acceptés : <strong>.jpg, .jpeg, .png</strong></p>
          <label className="upload-btn" htmlFor="signature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-upload" viewBox="0 0 16 16">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
  </svg> Choisir un fichier
            <input
              id='signature'
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => handleFileChange(e, 'signature')}
              required
            />
          </label>
          <div className="upload-status">{signatureStatus}</div>
        </div>

        {/* Bloc : passeport */}
        <div className="section">
             <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-file-earmark-text" viewBox="0 0 16 16">
  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
</svg>
          <h3>Pièce d'identité (Passeport)</h3>
          <p>Format accepté : <strong>.pdf</strong></p>
          <label className="upload-btn" htmlFor='passeport'>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-upload" viewBox="0 0 16 16">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
  </svg> Choisir un fichier
            <input
              id='passeport'
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, 'passeport')}
              required
            />
          </label>
          <div className="upload-status">{passeportStatus}</div>
        </div>

        {/* Bouton de validation */}
        <button type="submit" id="validateBtn" disabled={!isFormValid() || isSubmitting}>
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-down-square" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm8.5 2.5a.5.5 0 0 0-1 0v5.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293z"/>
</svg>
          Valider
        </button>

        {/* Message global */}
        <div className="form-status">{formStatus}</div>
      </form>
    </div>
  );
};

export default UploadForm;
