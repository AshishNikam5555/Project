/* Kadam Hospital seed data — single source of truth.
 * Used by: demo mode in the browser (window.CF_SEED) and tools/gen-seed-sql.js (→ supabase/seed.sql).
 * Items marked confirm:true / in config.to_confirm must be verified with the hospital before going live. */
(function (root) {
  const T = 'a0000000-0000-4000-8000-000000000001';
  const D1 = 'a0000000-0000-4000-8000-000000000101';
  const D2 = 'a0000000-0000-4000-8000-000000000102';
  const cat = n => 'a0000000-0000-4000-8000-0000000002' + String(n).padStart(2, '0');
  const svc = n => 'a0000000-0000-4000-8000-0000000003' + String(n).padStart(2, '0');

  const OPD = [
    ['10:00', '14:00'],
    ['17:00', '20:00']
  ]; // [CONFIRM] example hours
  const DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat, Sunday OPD closed

  const seed = {
    tenant: {
      id: T,
      slug: 'kadam-hospital',
      name: 'Kadam Hospital Accident & Orthopedic',
      config: {
        short_name: 'Kadam Hospital',
        short_name_mr: 'कदम हॉस्पिटल',
        tagline: 'Accident, Trauma & Orthopaedic Care — Shrirampur',
        tagline_mr: 'अपघात, ट्रॉमा व अस्थिरोग उपचार — श्रीरामपूर',
        address: 'Near Anarase Hospital, Belapur Road, Raskar Nagar (near MHADA Colony), Ward No. 7, Shrirampur MIDC, Dist. Ahmednagar, Maharashtra 413709',
        phone: '+91 90110 22349',
        whatsapp: '+91 90110 22349',
        emergency_24x7: true,
        opd_hours_text: 'Mon–Sat 10:00 AM–2:00 PM and 5:00–8:00 PM · Sunday OPD closed',
        opd_hours_text_mr: 'सोम–शनि सकाळी १०–दुपारी २ व सायं. ५–रात्री ८ · रविवारी ओपीडी बंद',
        languages: ['Marathi', 'Hindi', 'English'],
        google_maps_url: null,
        accent_color: '#0A84FF',
        timezone: 'Asia/Kolkata',
        booking_window_days: 7,
        token_prefix: 'KH',
        auto_confirm: true,
        retention_months: 12,
        demo: true,
        facilities: [
          { en: 'Open 24 hours', mr: '२४ तास सुरू', icon: 'clock' },
          { en: 'Wheelchair accessible', mr: 'व्हीलचेअर सुविधा', icon: 'accessibility' },
          { en: 'Car parking', mr: 'कार पार्किंग', icon: 'car' },
          { en: 'In-house X-Ray', mr: 'हॉस्पिटलमध्येच एक्स-रे', icon: 'scan' },
          { en: 'Physiotherapy unit', mr: 'फिजिओथेरपी विभाग', icon: 'activity' }
        ],
        to_confirm: [
          'OPD hours (currently an example: Mon–Sat 10–2 and 5–8)',
          'Chief surgeon’s full name, qualification and years of experience',
          'Physiotherapist’s name and qualification',
          'Consultation fees',
          'Hip replacement and arthroscopy are offered (hidden until confirmed)',
          'Cashless insurance: which TPAs / insurers (hidden until confirmed)',
          'Google Maps link',
          'Logo, building and doctor photos (with consent)',
          'Retention period for booking records (default 12 months)',
          'Marathi wording reviewed by hospital staff'
        ]
      }
    },
    doctors: [
      {
        id: D1,
        name: 'Dr. Kadam',
        name_mr: 'डॉ. कदम',
        role: 'Orthopaedic & Trauma Surgeon (Chief)',
        role_mr: 'अस्थिरोग व ट्रॉमा सर्जन (मुख्य)',
        qualification: null,
        experience_years: null,
        photo_url: null,
        fee_inr: null,
        active: true,
        sort: 1,
        confirm: true
      },
      {
        id: D2,
        name: 'Physiotherapy Team',
        name_mr: 'फिजिओथेरपी विभाग',
        role: 'Physiotherapy & Rehabilitation',
        role_mr: 'फिजिओथेरपी व पुनर्वसन',
        qualification: null,
        experience_years: null,
        photo_url: null,
        fee_inr: null,
        active: true,
        sort: 2,
        confirm: true
      }
    ],
    categories: [
      { id: cat(1), name: 'Accident & Trauma', name_mr: 'अपघात व ट्रॉमा', sort: 1, icon: 'siren' },
      { id: cat(2), name: 'Joint Replacement', name_mr: 'सांधे प्रत्यारोपण', sort: 2, icon: 'bone' },
      { id: cat(3), name: 'Bone, Joint & Spine', name_mr: 'हाडे, सांधे व मणका', sort: 3, icon: 'spine' },
      { id: cat(4), name: 'Paediatric Orthopaedics', name_mr: 'लहान मुलांचे अस्थिरोग', sort: 4, icon: 'baby' },
      { id: cat(5), name: 'Rehab & Diagnostics', name_mr: 'पुनर्वसन व तपासण्या', sort: 5, icon: 'activity' }
    ],
    // bookable:false → shown but not bookable. active:false → hidden until the hospital confirms.
    services: [
      [1, 1, '24×7 Accident & Emergency Care', '२४×७ अपघात व आपत्कालीन उपचार', { bookable: false, emergency: true }],
      [2, 1, 'Fracture Treatment & Plaster / Cast', 'फ्रॅक्चर उपचार व प्लास्टर'],
      [3, 1, 'Fracture Fixation Surgery (plates, nails, screws)', 'फ्रॅक्चर फिक्सेशन शस्त्रक्रिया (प्लेट, नेल, स्क्रू)'],
      [4, 1, 'Dislocation Management', 'सांधा निखळणे (डिसलोकेशन) उपचार'],
      [5, 1, 'Wound & Soft-tissue Injury Care', 'जखम व स्नायूंच्या दुखापतीवर उपचार'],
      [6, 2, 'Knee Replacement', 'गुडघा प्रत्यारोपण'],
      [7, 2, 'Shoulder Replacement', 'खांदा प्रत्यारोपण'],
      [8, 2, 'Hip Replacement', 'खुबा प्रत्यारोपण', { active: false, confirm: true }],
      [9, 3, 'Orthopaedic Consultation (OPD)', 'अस्थिरोग सल्ला (ओपीडी)'],
      [10, 3, 'Knee / Joint Pain & Arthritis Care', 'गुडघेदुखी, सांधेदुखी व संधिवात उपचार'],
      [11, 3, 'Back Pain & Spine Consultation', 'पाठदुखी व मणक्याचा सल्ला'],
      [12, 3, 'Sports & Ligament Injuries', 'खेळातील व लिगामेंट दुखापती'],
      [13, 3, 'Arthroscopy', 'आर्थ्रोस्कोपी', { active: false, confirm: true }],
      [14, 4, 'Paediatric Orthopaedic Consultation', 'लहान मुलांचा अस्थिरोग सल्ला'],
      [15, 4, 'Limb Lengthening & Deformity Correction', 'हात-पाय लांबी वाढवणे व व्यंग सुधारणा'],
      [16, 5, 'Individualised Physiotherapy', 'वैयक्तिक फिजिओथेरपी', { doctor: 2 }],
      [17, 5, 'Digital X-Ray', 'डिजिटल एक्स-रे', { bookable: false, walkin: true }],
      [18, 5, 'Diagnostic & Pathology Tests', 'निदान व पॅथॉलॉजी तपासण्या', { bookable: false, walkin: true }]
    ].map(([n, c, name, name_mr, o = {}]) => ({
      id: svc(n),
      category_id: cat(c),
      name,
      name_mr,
      duration_min: 15,
      bookable: o.bookable !== false,
      active: o.active !== false,
      sort: n,
      kind: o.emergency ? 'emergency' : o.walkin ? 'walkin' : 'appointment',
      confirm: !!o.confirm,
      doctor_ids: o.bookable === false ? [] : [o.doctor === 2 ? D2 : D1]
    })),
    availability: [D1, D2].flatMap(d => DAYS.flatMap(w => OPD.map(([s, e]) => ({ doctor_id: d, weekday: w, start_time: s, end_time: e, slot_min: 15 })))),
    leaves: []
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = seed;
  else root.CF_SEED = seed;
})(typeof window !== 'undefined' ? window : globalThis);
