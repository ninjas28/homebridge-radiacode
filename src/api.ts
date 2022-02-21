import axios from "axios";

export class RadiacodeApi {
  private clientAddress?: string;

  constructor(radiacodeServer?: string) {
    if (radiacodeServer == null) {
      return;
    }
    this.clientAddress = radiacodeServer
  }

  public async getLatestSamples() {
    if (this.clientAddress == null) {
      throw new Error("Radiacode API Client not initialized due to invalid configuration...");
    }

    const response = await axios.get<RadiacodeApiDeviceSample>(this.clientAddress + '/doserate')
    .catch(function (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);
    });
    return response?.data;
  }
  public async getHWInfo() {
    if (this.clientAddress == null) {
      throw new Error("Radiacode API Client not initialized due to invalid configuration...");
    }

    const response = await axios.get<RadiacodeApiDeviceInfo>(this.clientAddress + '/info')
    .catch(function (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
      }
      console.log(error.config);
    });
    return response?.data;
  }
}

export interface RadiacodeApiDeviceSample {
  data: {
    doserate?: number;
    timestamp?: number;
  }
}

export interface RadiacodeApiDeviceInfo {
  data: {
    serial?: string;
    fw_version?: string;
    battery?: number;
  }
}