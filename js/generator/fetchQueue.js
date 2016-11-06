'use strict';

// chrome only has a limited amount of memory for network requests (in testing it seems like you can simultaneously send approx 20k-22k requests at once)
// so we have to manage the number of simultaneous, in-flight requests

// we cap the maximum number of concurrent requests much lower to make sure that we don't break lower spec machines
const MAX_REQUESTS = 2000;

// in case we have duplicate requests - we cache the responses
const requestCache = new Map();

// the number of requests that are awaiting responses
let inFlightRequestCount = 0;
// the queue of requests waiting to be sent
const requestQueue = [];

let processorRunning = false;
function processQueue() {
    processorRunning = true;

    // enqueue as many requests as possible
    while (inFlightRequestCount < MAX_REQUESTS &&
           requestQueue.length > 0) {
        const currentReq = requestQueue.shift();

        // send the request
        fetch(currentReq.url)
          .then(response => response.text())
          .then((text) => {
              currentReq.resolveFn(text);
              inFlightRequestCount = inFlightRequestCount - 1;
          });

        inFlightRequestCount = inFlightRequestCount + 1;
    }

    if (requestQueue.length === 0) {
        // don't queue the processor if there's no more requeusts in the queue
        // the processor will auto-start when a new request is queued
        processorRunning = false;
    } else {
        // reschedule the processor
        setTimeout(processQueue, 10);
    }
}

// enqueues a request for processing when resources are free
function queueRequest(url) {
    // check the cache for an existing request promise
    if (requestCache.has(url)) {
        return requestCache.get(url).prom;
    }

    // build a new promise
    let resolveFn;
    const prom = new Promise((resolve) => {
        // store the resolve function for later calling
        resolveFn = resolve;
    });

    // enqueue the request
    const request = {
        resolveFn,
        prom,
        url,
    };
    requestQueue.push(request);
    // cache the data as well - by doing it now we can share promises before responses even return
    requestCache.set(url, request);

    // restart the processor
    if (!processorRunning) {
        setTimeout(processQueue());
    }

    return prom;
}

module.exports = queueRequest;
