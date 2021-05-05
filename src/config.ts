export const frontendUrl = 'http://localhost:4200/'
export const defaultAESKey = '1234' // fallback key to hash password
/**
 * fetchJotFormDataInterval
 * in milliseconds
 * Do not set too low, will risk exhausting daily limit (JotForm limits 1000 requests/day)
 */
export const fetchJotFormDataInterval = 1000000
export const systemEmail = 'trungminhtri.nguyen@my.ccsu.edu' // email sent by the application
/**
 * remindEmailInterval
 * min = 1800000 (30mins). Setting too low will potentially be disruptive to faculty
 * The interval to delay before sending a remind email to a faculty to hire student
 */
export const remindEmailInterval = 10000 // in miliseconds. 