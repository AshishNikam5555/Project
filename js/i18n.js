/* English / मराठी strings for patient pages. Source of truth; tools/export-i18n.js writes i18n/en.json + mr.json for translators.
 * Marathi drafted for the demo — have hospital staff review wording before going live. */
(function (root) {
  const D = {
    en: {
      book: 'Book appointment', call: 'Call', whatsapp: 'WhatsApp', directions: 'Directions',
      open24: 'Open 24 hrs · Emergency', opd_today_open: 'OPD open now', opd_today_closed: 'OPD closed now',
      emergency_title: 'Accident or emergency?', emergency_text: 'Come directly, no booking needed. Call {phone}',
      services: 'Services', doctors: 'Doctors', facilities: 'Facilities', visit_us: 'Visit us',
      opd_hours: 'OPD hours', address: 'Address', my_booking: 'My booking', my_booking_sub: 'Check or cancel your appointment',
      photo_soon: 'Hospital photo coming soon', doctor_photo: 'Photo', book_hint: 'Takes about 1 minute', services_count: '{n} services',
      fee_at_hospital: 'Fee payable at the hospital', fee: 'Consultation fee ₹{fee}', yrs: '{n} years experience',
      step: 'Step {n} of 3', step_service: 'Choose a service', step_slot: 'Choose doctor & time', step_details: 'Your details',
      search_services: 'Search services', all: 'All', emergency_label: 'Emergency · come directly', walkin_label: 'No booking needed · walk in',
      emergency_sheet: 'For accidents and emergencies, come directly to the hospital. We are open 24 hours.', walkin_sheet: 'No appointment is needed. Visit during OPD hours, or as advised by the doctor.',
      choose_doctor: 'Doctor', choose_date: 'Date', choose_time: 'Time', no_slots: 'No free slots on this day. Try another date.',
      morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', free: '{n} free', full: 'Full', closed: 'Closed', today: 'Today', tomorrow: 'Tomorrow',
      continue: 'Continue', back: 'Back', select_time: 'Select a time',
      name: 'Patient name', name_ph: 'Full name', mobile: 'Mobile number', mobile_ph: '10-digit mobile number', age: 'Age', age_ph: 'Optional',
      gender: 'Gender', female: 'Female', male: 'Male', other: 'Other', problem: 'Problem in brief', problem_ph: 'Optional, e.g. knee pain for 2 weeks',
      no_reports: 'Please don’t share reports or medical history here. The doctor will ask during your visit.',
      consent: 'I agree to be contacted by {hospital} about this appointment.',
      privacy_note: 'We use your name and mobile number only to manage this appointment. Records are deleted after {months} months.',
      confirm_booking: 'Confirm booking', booking: 'Booking…',
      booked_title: 'Appointment booked', requested_title: 'Request sent', requested_sub: 'The hospital will confirm your appointment shortly.',
      your_token: 'Your token number', date: 'Date', time: 'Time', service: 'Service', doctor: 'Doctor', status: 'Status',
      show_qr: 'Show this QR code at reception', arrive_early: 'Please arrive 10 minutes early. For emergencies, come directly, no booking needed.',
      share_wa: 'Send to WhatsApp', save_card: 'Save booking card', get_directions: 'Get directions', home: 'Back to home', book_another: 'Book another appointment',
      lookup_sub: 'Enter the mobile number and token number from your booking.', token_label: 'Token number', token_ph: 'e.g. KH-1128-017',
      find: 'Find booking', not_found: 'No booking found. Check the token and mobile number.', cancel_booking: 'Cancel appointment', cancel_confirm: 'Tap again to confirm cancellation',
      cancelled_ok: 'Your appointment is cancelled.', no_last: 'Booking details not found on this phone. Use “My booking” with your token number.',
      st_requested: 'Requested', st_confirmed: 'Confirmed', st_checked_in: 'Checked in', st_completed: 'Completed', st_cancelled: 'Cancelled', st_no_show: 'Missed',
      err_name: 'Please enter the patient’s name', err_mobile: 'Enter a valid 10-digit mobile number', err_consent: 'Please tick the box to agree to be contacted',
      saved_card: 'Booking card saved', share_text: 'My appointment at {hospital}\nToken: {token}\n{date}, {time}\n{service} · {doctor}\nAddress: {address}',
      loading: 'Loading…', offline: 'Could not load. Check your internet connection and try again.', retry: 'Try again'
    },
    mr: {
      book: 'अपॉइंटमेंट बुक करा', call: 'कॉल करा', whatsapp: 'व्हॉट्सॲप', directions: 'रस्ता दाखवा',
      open24: '२४ तास सुरू · आपत्कालीन सेवा', opd_today_open: 'ओपीडी आता सुरू', opd_today_closed: 'ओपीडी आता बंद',
      emergency_title: 'अपघात किंवा आपत्कालीन स्थिती?', emergency_text: 'थेट हॉस्पिटलमध्ये या, बुकिंगची गरज नाही. कॉल करा {phone}',
      services: 'सेवा', doctors: 'डॉक्टर', facilities: 'सुविधा', visit_us: 'आम्हाला भेट द्या',
      opd_hours: 'ओपीडी वेळ', address: 'पत्ता', my_booking: 'माझे बुकिंग', my_booking_sub: 'तुमची अपॉइंटमेंट पहा किंवा रद्द करा',
      photo_soon: 'हॉस्पिटलचा फोटो लवकरच', doctor_photo: 'फोटो', book_hint: 'फक्त १ मिनिट लागते', services_count: '{n} सेवा',
      fee_at_hospital: 'शुल्क हॉस्पिटलमध्ये भरावे', fee: 'सल्ला शुल्क ₹{fee}', yrs: '{n} वर्षांचा अनुभव',
      step: 'पायरी {n} / ३', step_service: 'सेवा निवडा', step_slot: 'डॉक्टर व वेळ निवडा', step_details: 'तुमची माहिती',
      search_services: 'सेवा शोधा', all: 'सर्व', emergency_label: 'आपत्कालीन · थेट या', walkin_label: 'बुकिंगची गरज नाही · थेट या',
      emergency_sheet: 'अपघात व आपत्कालीन स्थितीत थेट हॉस्पिटलमध्ये या. आम्ही २४ तास सुरू आहोत.', walkin_sheet: 'अपॉइंटमेंटची गरज नाही. ओपीडी वेळेत किंवा डॉक्टरांच्या सल्ल्यानुसार या.',
      choose_doctor: 'डॉक्टर', choose_date: 'तारीख', choose_time: 'वेळ', no_slots: 'या दिवशी वेळ उपलब्ध नाही. दुसरी तारीख निवडा.',
      morning: 'सकाळ', afternoon: 'दुपार', evening: 'संध्याकाळ', free: '{n} उपलब्ध', full: 'भरले', closed: 'बंद', today: 'आज', tomorrow: 'उद्या',
      continue: 'पुढे', back: 'मागे', select_time: 'वेळ निवडा',
      name: 'रुग्णाचे नाव', name_ph: 'पूर्ण नाव', mobile: 'मोबाईल नंबर', mobile_ph: '१० अंकी मोबाईल नंबर', age: 'वय', age_ph: 'ऐच्छिक',
      gender: 'लिंग', female: 'स्त्री', male: 'पुरुष', other: 'इतर', problem: 'त्रास थोडक्यात', problem_ph: 'ऐच्छिक, उदा. २ आठवड्यांपासून गुडघेदुखी',
      no_reports: 'कृपया येथे रिपोर्ट किंवा वैद्यकीय इतिहास लिहू नका. डॉक्टर भेटीत विचारतील.',
      consent: 'या अपॉइंटमेंटबद्दल {hospital} ने माझ्याशी संपर्क साधण्यास माझी संमती आहे.',
      privacy_note: 'तुमचे नाव व मोबाईल नंबर फक्त या अपॉइंटमेंटसाठी वापरला जातो. नोंदी {months} महिन्यांनंतर हटवल्या जातात.',
      confirm_booking: 'बुकिंग निश्चित करा', booking: 'बुकिंग होत आहे…',
      booked_title: 'अपॉइंटमेंट बुक झाली', requested_title: 'विनंती पाठवली', requested_sub: 'हॉस्पिटल लवकरच तुमची अपॉइंटमेंट निश्चित करेल.',
      your_token: 'तुमचा टोकन नंबर', date: 'तारीख', time: 'वेळ', service: 'सेवा', doctor: 'डॉक्टर', status: 'स्थिती',
      show_qr: 'हा QR कोड रिसेप्शनवर दाखवा', arrive_early: 'कृपया १० मिनिटे आधी या. आपत्कालीन स्थितीत थेट या, बुकिंगची गरज नाही.',
      share_wa: 'व्हॉट्सॲपवर पाठवा', save_card: 'बुकिंग कार्ड सेव्ह करा', get_directions: 'रस्ता दाखवा', home: 'मुख्य पानावर जा', book_another: 'दुसरी अपॉइंटमेंट बुक करा',
      lookup_sub: 'बुकिंगचा मोबाईल नंबर व टोकन नंबर टाका.', token_label: 'टोकन नंबर', token_ph: 'उदा. KH-1128-017',
      find: 'बुकिंग शोधा', not_found: 'बुकिंग सापडले नाही. टोकन व मोबाईल नंबर तपासा.', cancel_booking: 'अपॉइंटमेंट रद्द करा', cancel_confirm: 'रद्द करण्यासाठी पुन्हा टॅप करा',
      cancelled_ok: 'तुमची अपॉइंटमेंट रद्द झाली.', no_last: 'या फोनवर बुकिंगची माहिती नाही. टोकन नंबरसह “माझे बुकिंग” वापरा.',
      st_requested: 'विनंती', st_confirmed: 'निश्चित', st_checked_in: 'आगमन नोंद', st_completed: 'पूर्ण', st_cancelled: 'रद्द', st_no_show: 'आले नाहीत',
      err_name: 'कृपया रुग्णाचे नाव टाका', err_mobile: 'योग्य १० अंकी मोबाईल नंबर टाका', err_consent: 'संमतीसाठी चौकटीत टिक करा',
      saved_card: 'बुकिंग कार्ड सेव्ह झाले', share_text: '{hospital} येथे माझी अपॉइंटमेंट\nटोकन: {token}\n{date}, {time}\n{service} · {doctor}\nपत्ता: {address}',
      loading: 'लोड होत आहे…', offline: 'लोड झाले नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.', retry: 'पुन्हा प्रयत्न करा'
    }
  };
  // Server error messages → Marathi
  const ERR_MR = {
    'Sorry, this slot was just taken. Please choose another time': 'माफ करा, ही वेळ नुकतीच बुक झाली. कृपया दुसरी वेळ निवडा',
    'Too many bookings from this number. Please call the hospital': 'या नंबरवरून खूप बुकिंग झाली आहेत. कृपया हॉस्पिटलला कॉल करा',
    'This time has already passed. Please choose a later slot': 'ही वेळ निघून गेली आहे. कृपया पुढची वेळ निवडा',
    'The doctor is on leave that day. Please choose another date': 'त्या दिवशी डॉक्टर रजेवर आहेत. कृपया दुसरी तारीख निवडा',
    'The doctor is not available at this time': 'या वेळी डॉक्टर उपलब्ध नाहीत',
    'Enter a valid 10-digit mobile number': 'योग्य १० अंकी मोबाईल नंबर टाका',
    'No booking found for this token and mobile number': 'या टोकन व मोबाईल नंबरसाठी बुकिंग सापडले नाही',
    'This booking can no longer be cancelled online': 'हे बुकिंग आता ऑनलाइन रद्द करता येणार नाही',
    'This appointment time has passed': 'या अपॉइंटमेंटची वेळ निघून गेली आहे'
  };
  const DIG = '०१२३४५६७८९';
  let lang = 'en';
  try { lang = localStorage.getItem('cf-lang') || ((navigator.language || '').startsWith('mr') ? 'mr' : 'en'); } catch (e) {}
  const t = (k, v = {}) => String((D[lang] && D[lang][k]) ?? D.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const I18N = {
    dict: D, t, get lang() { return lang; },
    set(l) { lang = l === 'mr' ? 'mr' : 'en'; try { localStorage.setItem('cf-lang', lang); } catch (e) {} document.documentElement.lang = lang; },
    pick: (o, f = 'name') => (lang === 'mr' && o && o[f + '_mr']) || (o && o[f]) || '',
    err: m => (lang === 'mr' && ERR_MR[m]) || m,
    digits: s => lang === 'mr' ? String(s).replace(/\d/g, d => DIG[d]) : String(s),
    dateLabel(k, todayKey) {
      const [y, m, d] = k.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    },
    apply(rootEl = document) {
      rootEl.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
      rootEl.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    }
  };
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (typeof module !== 'undefined' && module.exports) module.exports = { D };
  else root.I18N = I18N;
})(typeof window !== 'undefined' ? window : globalThis);
