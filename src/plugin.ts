import { RadiacodeApi, RadiacodeApiDeviceSample } from "./api";
import { Mutex } from "async-mutex";
import { AccessoryConfig, AccessoryPlugin, API, Logging, Service } from "homebridge";

export = (api: API) => {
  api.registerAccessory("Radiacode", RadiacodePlugin);
};

class RadiacodePlugin implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly mutex: Mutex;

  private readonly radiacodeApi: RadiacodeApi;
  private readonly radiacodeConfig: RadiacodePluginConfig;

  private readonly informationService: Service;
  private readonly airQualityService: Service;

  private latestSamples: RadiacodeApiDeviceSample = {
    data: {}
  };
  private latestSamplesTimestamp: number = 0;

  constructor(log: Logging, config: RadiacodePluginConfig, api: API) {
    if (config.radiacodeServer == null) {
      log.error("Missing required config value: radiacodeServer");
    }

    this.log = log;
    this.mutex = new Mutex();

    this.radiacodeApi = new RadiacodeApi(config.radiacodeServer);
    this.radiacodeConfig = config;

    // HomeKit Information Service
    this.informationService = new api.hap.Service.AccessoryInformation()
      .setCharacteristic(api.hap.Characteristic.Manufacturer, "Radiascan")
      .setCharacteristic(api.hap.Characteristic.Model, "Radiascan 101")
      .setCharacteristic(api.hap.Characteristic.Name, config.name)
      .setCharacteristic(api.hap.Characteristic.SerialNumber, 'config.serialNumber')
      .setCharacteristic(api.hap.Characteristic.FirmwareRevision, 'unknown');
    // HomeKit Air Quality Service
    this.airQualityService = new api.hap.Service.AirQualitySensor("Dose Rate");

    this.airQualityService.getCharacteristic(api.hap.Characteristic.AirQuality)
      .onGet(async () => {
        await this.getLatestSamples();

        let aq = api.hap.Characteristic.AirQuality.UNKNOWN;

        const doserate = this.latestSamples.data.doserate;
        if (doserate) {
          this.log(doserate.toString(10))
          if (doserate >= 0.4) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.POOR);
          }
          else if (doserate >= 0.2) {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.FAIR);
          }
          else {
            aq = Math.max(aq, api.hap.Characteristic.AirQuality.EXCELLENT);
          }
        } else {
          this.log("doserate undefined?")
        }

        return aq;
      });

    // const doserateCharacteristic = new api.hap.Characteristic('Dose Rate', "b42e01aa-ade7-11e4-89d3-123b93f75cba", {
    //   format: api.hap.Formats.FLOAT,
    //   perms: [api.hap.Perms.NOTIFY, api.hap.Perms.PAIRED_READ],
    //   unit: "uSv/hr",
    //   minValue: 0,
    //   maxValue: 999,
    //   minStep: 0.001,
    // }).onGet(async () => {
    //   await this.getLatestSamples();
    //   return this.latestSamples.data.doserate ?? 0;
    // });

    // this.airQualityService.addCharacteristic(doserateCharacteristic);

    this.airQualityService.getCharacteristic(api.hap.Characteristic.StatusActive)
      .onGet(async () => {
        await this.getLatestSamples();
        return this.latestSamples.data.timestamp != null && Date.now() / 1000 - this.latestSamples.data.timestamp < 2 * 60 * 60;
      });
  }

  getServices(): Service[] {
    const services = [this.informationService, this.airQualityService];
    return services;
  }

  async getLatestSamples() {
    await this.mutex.runExclusive(async () => {
      if (Date.now() - this.latestSamplesTimestamp > 5 * 1000) {
        this.log.info(`Refreshing latest samples...`)

        try {
          this.latestSamples = await this.radiacodeApi.getLatestSamples() ?? {data:{}};
          this.latestSamplesTimestamp = Date.now();
          this.log.info(JSON.stringify(this.latestSamples.data));
        }
        catch (err) {
          if (err instanceof Error) {
            this.log.error(err.message);
          }
        }
      }
    });
  }
}

interface RadiacodePluginConfig extends AccessoryConfig {
  radiacodeServer?: string;
}
