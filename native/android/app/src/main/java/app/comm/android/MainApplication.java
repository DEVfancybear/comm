package app.comm.android;

import android.content.Context;
import android.content.res.Configuration;
import android.database.CursorWindow;
import androidx.annotation.NonNull;
import androidx.multidex.MultiDexApplication;
import app.comm.android.fbjni.CommSecureStore;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.JSIModulePackage;
import com.facebook.soloader.SoLoader;
import com.wix.reactnativekeyboardinput.KeyboardInputPackage;
import expo.modules.ApplicationLifecycleDispatcher;
import expo.modules.ExpoModulesPackage;
import expo.modules.ExpoModulesPackageList;
import expo.modules.ModuleRegistryAdapter;
import expo.modules.ReactModuleRegistyrProvider;
import expo.modules.ReactNativeHostWrapper;
import expo.modules.securestore.SecureStoreModule;
import io.invertase.firebase.messaging.RNFirebaseMessagingPackage;
import io.invertase.firebase.notifications.RNFirebaseNotificationsPackage;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.security.Security;
import java.util.List;
import java.util.stream.Collectors;
public class MainApplication
    extends MultiDexApplication implements ReactApplication {

  static {
    System.loadLibrary("comm_jni_module");
  }

  private final ReactModuleRegistryProvider moduleRegistryProvider =
      new ReactModuleRegistryProvider(ExpoModulesPackageList.getPackageList());

  private final ReactNativeHost mReactNativeHost =
      new ReactNativeHostWrapper(this, new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          List<ReactPackage> manuallyLinkedPackages =
              packages.stream()
                  .filter(!reactPackage instanceof ExpoModulesPackage)
                  .collect(Collectors.toList());
          manuallyLinkedPackages.add(new RNFirebaseMessagingPackage());
          manuallyLinkedPackages.add(new RNFirebaseNotificationsPackage());
          manuallyLinkedPackages.add(
              new KeyboardInputPackage(this.getApplication()));
          manuallyLinkedPackages.add(new CommPackage());

          ModuleRegistryAdapter adapter = new ModuleRegistryAdapter(
              moduleProvider, new ExpoModulesPackageList());
          manuallyLinkedPackages.add(adapter);
          return manuallyLinkedPackages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected JSIModulePackage getJSIModulePackage() {
          SecureStoreModule secureStoreModule =
              (SecureStoreModule)moduleRegistryProvider
                  .get(getApplicationContext())
                  .getExportedModuleOfClass(SecureStoreModule.class);
          CommSecureStore.getInstance().initialize(secureStoreModule);
          return new CommCoreJSIModulePackage();
        }
      });

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    Security.insertProviderAt(new org.conscrypt.OpenSSLProvider(), 1);
    SoLoader.init(this, /* native exopackage */ false);
    initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    ApplicationLifecycleDispatcher.onApplicationCreate(this);
    try {
      Field field = CursorWindow.class.getDeclaredField("sCursorWindowSize");
      field.setAccessible(true);
      field.set(null, 100 * 1024 * 1024); // 100 MiB
    } catch (Exception e) {
      if (BuildConfig.DEBUG) {
        e.printStackTrace();
      }
    }
  }

  @Override
  public void onConfigurationChanged(@NonNull Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig);
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method
   * with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context,
      ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        // We use reflection here to pick up the class that initializes Flipper,
        // since Flipper library is not available in release mode
        Class<?> aClass = Class.forName("app.comm.android.ReactNativeFlipper");
        aClass
            .getMethod(
                "initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }
}
